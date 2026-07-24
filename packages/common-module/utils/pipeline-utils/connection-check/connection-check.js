import knex from 'knex';
import { Database } from 'arangojs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { db, env } from '../../../config/index.js';
import { checkHealth } from '@web/pbf/db/connection.js';

async function checkConnection(configName) {
  try {
    const dbCredentials = db[configName];

    if (!dbCredentials.client) {
      if (configName == 'bfi_db_lora_lts' || configName == 'bfi_db_lora_partnership_ndf') {
        dbCredentials.client = 'arango';
        const connection = new Database(dbCredentials);
        const query = await connection.query('RETURN 1');
        await query.all();
      }

      if (configName == 'pbf') {
        dbCredentials.client = 'salesforce';
        await checkHealth();
      }
    } else {
      const connection = knex(dbCredentials);

      await connection.raw('SELECT 1');
      await connection.destroy();
    }

    return {
      status: 'healthy',
      message: `${dbCredentials.client} connection successful`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `$${db[configName].client} connection failed: ${error.message}`
    };
  }
}

function checkHttpConnection(url, timeout = 1000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: timeout,
        headers: { 'User-Agent': 'BFI-Health-Check/1.0' }
      };

      const req = client.request(options, (res) => {
        const responseTime = Date.now() - startTime;

        // Any response that isn't a timeout means the URL is reachable
        resolve({
          status: 'healthy',
          message: `HTTP ${res.statusCode} - ${res.statusMessage} (${responseTime}ms) - REACHABLE`,
          url: url,
          statusCode: res.statusCode,
          responseTime: responseTime
        });

        res.resume();
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          status: 'unhealthy',
          message: `Network issue (${error.code}): ${error.message} (${responseTime}ms) - NOT REACHABLE`,
          url: url,
          error: error.message,
          errorCode: error.code,
          responseTime: responseTime
        });
      });

      req.on('timeout', () => {
        const responseTime = Date.now() - startTime;
        req.destroy();
        resolve({
          status: 'unhealthy',
          message: `Connection timeout after ${timeout}ms - NOT REACHABLE`,
          url: url,
          error: 'timeout',
          responseTime: responseTime
        });
      });

      req.end();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      resolve({
        status: 'error',
        message: `Invalid URL: ${error.message} (${responseTime}ms)`,
        url: url,
        error: error.message,
        responseTime: responseTime
      });
    }
  });
}

function extractHttpUrls(obj, urls = new Set(), path = '') {
  if (typeof obj === 'string') {
    if (obj.match(/^https?:\/\//)) {
      urls.add({
        url: obj,
        path
      });
    }
  } else if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      extractHttpUrls(value, urls, path ? `${path}.${key}` : key);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractHttpUrls(item, urls, `${path}[${index}]`);
    });
  }
  return urls;
}

async function checkAllHttpConnections() {
  const urls = extractHttpUrls(env);
  const results = {};

  const promises = Array.from(urls).map(async ({ url, path }) => {
    const result = await checkHttpConnection(url);
    return {
      url,
      path,
      result
    };
  });

  const settledResults = await Promise.allSettled(promises);

  settledResults.forEach((promiseResult, index) => {
    if (promiseResult.status === 'fulfilled') {
      const {
        url, path, result
      } = promiseResult.value;
      results[path] = {
        ...result,
        url: url
      };
    } else {
      const { url, path } = Array.from(urls)[index];
      results[path] = {
        status: 'error',
        message: `Promise failed: ${promiseResult.reason?.message || 'Unknown error'}`,
        url: url
      };
    }
  });

  return {
    results,
    urlCount: urls.size
  };
}

async function checkAllDatabaseHealth() {
  const results = {};

  for (const configName in db) {
    results[configName] = await checkConnection(configName);
  }

  return results;
}

async function checkAllHealth() {
  const dbResults = await checkAllDatabaseHealth();
  const httpResultData = await checkAllHttpConnections();

  return {
    databases: dbResults,
    httpConnections: httpResultData.results,
    httpUrlCount: httpResultData.urlCount
  };
}

export { checkAllDatabaseHealth, checkAllHealth };

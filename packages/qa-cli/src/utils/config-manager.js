/* eslint-disable no-console */
import path from 'path';
import fs from 'fs/promises';
import { getRepoRoot } from './executor.js';

/**
 * Get config directory path
 * @returns {string} - Config directory path
 */
function getConfigDir() {
  return path.join(getRepoRoot(), 'packages/common-module/config');
}

/**
 * Create environment config file
 * @param {string} env - Environment (SIT/UAT)
 * @param {object} answers - Configuration answers
 * @returns {Promise<string>} - Path to created config file
 */
export async function createEnvConfig(env, answers) {
  const config = {
    apiUrl: answers.apiUrl,
    apiVersion: answers.apiVersion || 'v2.1',
    authUrl: answers.authUrl,
    timeout: parseInt(answers.timeout) || 30000,
    retryCount: parseInt(answers.retryCount) || 2,
    additionalHeaders: answers.additionalHeaders || {}
  };

  const configPath = path.join(
    getConfigDir(),
    `env.${env.toLowerCase()}.json`
  );

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Create database config file
 * @param {string} env - Environment (SIT/UAT)
 * @param {object} answers - Database configuration answers
 * @returns {Promise<string>} - Path to created config file
 */
export async function createDbConfig(env, answers) {
  const config = {
    client: 'pg',
    connection: {
      host: answers.dbHost,
      port: parseInt(answers.dbPort) || 5432,
      database: answers.dbName,
      user: answers.dbUsername,
      password: answers.dbPassword,
      ssl: answers.ssl || false
    },
    pool: {
      min: 2,
      max: 10
    }
  };

  const configPath = path.join(
    getConfigDir(),
    `db.${env.toLowerCase()}.json`
  );

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Create mobile config file
 * @param {string} env - Environment (SIT/UAT)
 * @param {object} answers - Mobile configuration answers
 * @returns {Promise<string>} - Path to created config file
 */
export async function createMobileConfig(env, answers) {
  const config = {
    appiumServer: answers.appiumServer || 'http://localhost:4723/wd/hub',
    deviceType: answers.deviceType || 'android',
    appPath: answers.appPath,
    appiumCapabilities: answers.appiumCapabilities || {},
    timeout: parseInt(answers.timeout) || 60000
  };

  const configPath = path.join(
    getConfigDir(),
    `mobile.env.${env.toLowerCase()}.json`
  );

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Check if config files exist
 * @param {string} env - Environment (SIT/UAT)
 * @returns {Promise<object>} - Object with existence status
 */
export async function checkConfigFiles(env) {
  const envLower = env.toLowerCase();
  const configDir = getConfigDir();

  const envFile = path.join(configDir, `env.${envLower}.json`);
  const dbFile = path.join(configDir, `db.${envLower}.json`);
  const mobileFile = path.join(configDir, `mobile.env.${envLower}.json`);

  return {
    env: await fileExists(envFile),
    db: await fileExists(dbFile),
    mobile: await fileExists(mobileFile)
  };
}

/**
 * Load existing config file
 * @param {string} env - Environment (SIT/UAT)
 * @param {string} type - Config type (env/db/mobile)
 * @returns {Promise<object|null>} - Config object or null if not found
 */
export async function loadConfig(env, type) {
  const envLower = env.toLowerCase();
  const configPath = path.join(
    getConfigDir(),
    `${type}.${envLower}.json`
  );

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} - File exists status
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save mobile environment variables to .env file
 * @param {object} config - Mobile configuration
 * @returns {Promise<string>} - Path to .env file
 */
export async function saveMobileEnvVars(config) {
  const repoRoot = getRepoRoot();
  const envFilePath = path.join(repoRoot, '.env');

  const envContent = [
    `DEVICE_TYPE=${config.deviceType || 'android'}`,
    `RUN_TYPE=${config.runType || 'LOCAL'}`,
    `SQUAD=${config.squad || ''}`,
    `SPEC_PATTERN=${config.specPattern || '__tests__/mobile/**/*.spec.js'}`,
    `APP=${config.appPath || ''}`
  ].join('\n');

  await fs.writeFile(envFilePath, envContent);
  return envFilePath;
}

/**
 * Load .env file for mobile testing
 * @returns {Promise<object>} - Environment variables object
 */
export async function loadMobileEnvVars() {
  const repoRoot = getRepoRoot();
  const envFilePath = path.join(repoRoot, '.env');

  try {
    const content = await fs.readFile(envFilePath, 'utf-8');
    const envVars = {};

    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=');
      }
    });

    return envVars;
  } catch (error) {
    return {};
  }
}
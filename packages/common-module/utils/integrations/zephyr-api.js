/* eslint-disable no-console */
// API Doc: https://support.smartbear.com/zephyr-scale-cloud/api-docs

import { zephyrConfig } from '../../config/zephyr-config.js';
import { env } from '../../config/index.js';
import { RateLimiter } from './rate-limiter.js';
import axios from 'axios';

const BASE_URL = env.ZEPHYR.BASE_URL;
const API_KEY = env.ZEPHYR.API_KEY;

// Create a singleton rate limiter instance for Zephyr API (500 requests per 60 seconds)
const zephyrRateLimiter = new RateLimiter(500, 60);

class ZephyrAPIError extends Error {
  constructor(message, statusCode, responseData, requestDetails = null) {
    super(message);
    this.name = 'ZephyrAPIError';
    this.statusCode = statusCode;
    this.responseData = responseData;
    this.requestDetails = requestDetails;

    this.logError();
  }

  logError() {
    const logData = {
      message: this.message,
      statusCode: this.statusCode,
      ...(this.requestDetails && { request: this.requestDetails }),
      ...(this.responseData && { response: this.responseData })
    };

    const logType = this.statusCode >= 400 && this.statusCode < 500
      ? '[Zephyr API Error]'
      : '[Zephyr API Unexpected Error]';

    console.error(logType, JSON.stringify(logData));
  }
}

// Export the rate limiter so other modules can use the same instance
export { zephyrRateLimiter };

export default class ZephyrAPI {
  static requestHeaders(additionalHeaders = {}) {
    return {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...additionalHeaders
    };
  }

  static async makeRequest(config) {
    try {
      await zephyrRateLimiter.waitForAvailability('Zephyr API');

      const response = await axios({
        ...config,
        headers: this.requestHeaders(config.headers),
        validateStatus: (status) => status < 500
      });

      if (response.status >= 400) {
        const requestDetails = {
          url: config.url,
          method: config.method,
          body: config.data || 'No request body'
        };

        throw new ZephyrAPIError(
          `Request failed with status ${response.status}`,
          response.status,
          response.data,
          requestDetails
        );
      }

      return {
        status: response.status,
        response: response.data
      };
    } catch (error) {
      if (error instanceof ZephyrAPIError) {
        throw error;
      }

      const requestDetails = {
        url: config.url,
        method: config.method,
        body: config.data || 'No request body',
        originalError: error.message
      };

      throw new ZephyrAPIError(
        error.message || 'An unexpected error occurred',
        500,
        null,
        requestDetails
      );
    }
  }

  static getProjectConfigBySquadName(squad) {
    const data = zephyrConfig.filter((val) => val.squad === squad);
    return data.length > 0 ? data : null;
  }

  static getProjectConfigByKey(key) {
    const data = zephyrConfig.filter((val) => val.key === key);
    return data.length > 0 ? data : null;
  }

  static getListProjectKeys() {
    const keys = zephyrConfig.map((val) => val.key);
    return keys.length > 0 ? keys : [];
  }

  static getAllProject() {
    return zephyrConfig;
  }

  static async getTestCaseByTestCaseKey(testCaseKey) {
    if (!testCaseKey) {
      throw new Error('Test case key is required');
    }

    return this.makeRequest({
      method: 'GET',
      url: `${BASE_URL}/testcases/${testCaseKey}`
    });
  }

  static async updateTestCaseByTestCaseKey(testCaseKey, testCaseData) {
    if (!testCaseKey) {
      throw new Error('Test case key is required');
    }

    if (!testCaseData || typeof testCaseData !== 'object') {
      throw new Error('Test case data must be a valid object');
    }

    return this.makeRequest({
      method: 'PUT',
      url: `${BASE_URL}/testcases/${testCaseKey}`,
      data: testCaseData
    });
  }

  static async createTestCase(projectKey, name, folderId) {
    if (!projectKey || !name) {
      throw new Error('Project key and name are required');
    }

    const requestBody = {
      projectKey,
      name,
      ...(folderId && { folderId })
    };

    return this.makeRequest({
      method: 'POST',
      url: `${BASE_URL}/testcases`,
      data: requestBody
    });
  }

  static async createTestCycle(params) {
    if (!params.projectKey) {
      throw new Error('Project key is required');
    }

    if (!params.name) {
      throw new Error('Test Cycle Name is required');
    }

    const requestBody = {
      projectKey: params.projectKey,
      name: params.name,
      ...params
    };

    return this.makeRequest({
      method: 'POST',
      url: `${BASE_URL}/testcycles`,
      data: requestBody
    });
  }

  static async createTestExecution(params) {
    const requiredFields = ['projectKey', 'testCaseKey', 'testCycleKey', 'statusName'];
    const missingFields = requiredFields.filter(field => !params[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const requestBody = {
      projectKey: params.projectKey,
      testCaseKey: params.testCaseKey,
      testCycleKey: params.testCycleKey,
      statusName: params.statusName,
      ...params
    };

    return this.makeRequest({
      method: 'POST',
      url: `${BASE_URL}/testexecutions`,
      data: requestBody
    });
  }

  static async updateTestExecution(testExecutionId, params) {
    if (!testExecutionId || (typeof testExecutionId === 'string' && !testExecutionId.trim())) {
      throw new Error('Test execution ID is required');
    }
    const requiredFields = ['projectKey', 'testCaseKey', 'testCycleKey', 'statusName'];
    const missingFields = requiredFields.filter(field => !params[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const requestBody = {
      projectKey: params.projectKey,
      testCaseKey: params.testCaseKey,
      testCycleKey: params.testCycleKey,
      statusName: params.statusName,
      ...params
    };

    // console.log(JSON.stringify(requestBody));
    await new Promise((resolve) => setTimeout(resolve, 20000));

    return this.makeRequest({
      method: 'PUT',
      url: `${BASE_URL}/testexecutions/${testExecutionId}`,
      data: requestBody
    });
  }

  static async updateTcStatusByTcKey(testCaseKey, params) {
    const testCaseRes = await this.getTestCaseByTestCaseKey(testCaseKey);
    const updatedTestCaseData = {
      ...testCaseRes.response,
      ...params
    };

    updatedTestCaseData.customFields['Will Covered By Automation?'] = 'Yes';

    return this.updateTestCaseByTestCaseKey(testCaseKey, updatedTestCaseData);
  }

  static async createOrUpdate({
    projectKey, title, folderId, testCaseKey
  }) {
    if (testCaseKey) {
      const testCaseRes = await this.getTestCaseByTestCaseKey(testCaseKey);
      testCaseRes.response.name = title;
      const response = await this.updateTestCaseByTestCaseKey(testCaseKey, testCaseRes.response);

      return response.key;

    }
    const response = await this.createTestCase(projectKey, title, folderId);
    return response.response.key;
  }
}

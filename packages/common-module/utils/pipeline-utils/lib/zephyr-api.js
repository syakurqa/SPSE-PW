import axios from 'axios';
import { env } from '../../../config/index.js';

const BASE_URL = env.ZEPHYR.BASE_URL;
const API_KEY = env.ZEPHYR.API_KEY;

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch all pages from a paginated Zephyr Scale API endpoint.
 */
export async function fetchAllPages(url) {
  const allValues = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await axios.get(nextUrl, { headers: headers() });
    const data = response.data;
    allValues.push(...(data.values || []));
    nextUrl = data.next || null;
  }

  return allValues;
}

export async function getFolders(projectKey) {
  return fetchAllPages(
    `${BASE_URL}/folders?projectKey=${projectKey}&folderType=TEST_CYCLE&maxResults=1000`
  );
}

export async function getTestCyclesByFolder(folderId) {
  return fetchAllPages(
    `${BASE_URL}/testcycles?folderId=${folderId}&maxResults=1000`
  );
}

/**
 * Fetch all test cycles in a Zephyr project.
 */
export async function getTestCyclesByProject(projectKey) {
  return fetchAllPages(
    `${BASE_URL}/testcycles?projectKey=${projectKey}&maxResults=1000`
  );
}

export async function getTestExecutions(testCycleKey) {
  return fetchAllPages(
    `${BASE_URL}/testexecutions?testCycle=${testCycleKey}&onlyLastExecutions=true&maxResults=1000`
  );
}

export async function getTestCase(testCaseKey) {
  const response = await axios.get(`${BASE_URL}/testcases/${testCaseKey}`, { headers: headers() });
  return response.data;
}

/**
 * Fetch all test cases in a Zephyr project.
 */
export async function getTestCases(projectKey) {
  return fetchAllPages(
    `${BASE_URL}/testcases?projectKey=${projectKey}&maxResults=1000`
  );
}

/**
 * Create a new test cycle in Zephyr.
 */
export async function createTestCycle({
  projectKey, name, folderId, description
}) {
  const body = {
    projectKey,
    name,
    ...(folderId && { folderId }),
    ...(description && { description }),
  };
  const response = await axios.post(`${BASE_URL}/testcycles`, body, { headers: headers() });
  return response.data;
}

/**
 * Create a test execution (add a test case to a test cycle).
 * statusName defaults to "Not Executed".
 */
export async function createTestExecution({
  projectKey, testCycleKey, testCaseKey, statusName = 'Not Executed'
}) {
  const body = {
    projectKey,
    testCycleKey,
    testCaseKey,
    statusName,
  };
  const response = await axios.post(`${BASE_URL}/testexecutions`, body, { headers: headers() });
  return response.data;
}

export async function createFolder({
  projectKey, name, parentId, folderType = 'TEST_CYCLE'
}) {
  const body = {
    projectKey,
    name,
    folderType,
    ...(parentId && { parentId }),
  };
  const response = await axios.post(`${BASE_URL}/folders`, body, { headers: headers() });
  return response.data;
}

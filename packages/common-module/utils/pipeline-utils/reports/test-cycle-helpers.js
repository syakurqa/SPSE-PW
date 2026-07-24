/* eslint-disable no-console */
import fs from 'fs';
import ZephyrAPI, { zephyrRateLimiter } from '../../integrations/zephyr-api.js';
import { env } from '../../../config/index.js';

const BATCH_SIZE = 50;

function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fileToBase64(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[Warning] Attachment file not found: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath).toString('base64');
  } catch (error) {
    console.log(`[Warning] Failed to read attachment file: ${filePath} - ${error.message}`);
    return null;
  }
}

function buildComment(testExecution) {
  const parts = [];

  if (testExecution.stdout && testExecution.stdout.length > 0) {
    const stdoutText = testExecution.stdout
      .map(item => typeof item === 'string' ? item : item.text || '')
      .join('\n');
    if (stdoutText.trim()) {
      parts.push(`<h3>Stdout</h3>\n<pre>${escapeHtml(stripAnsi(stdoutText))}</pre>`);
    }
  }

  if (testExecution.errors && testExecution.errors.length > 0) {
    const errorText = testExecution.errors
      .map(err => stripAnsi(err.message || ''))
      .join('\n\n');
    if (errorText.trim()) {
      parts.push(`<h3>Errors</h3>\n<pre>${escapeHtml(errorText)}</pre>`);
    }
  }

  if (testExecution.attachments && testExecution.attachments.length > 0) {
    for (const attachment of testExecution.attachments) {
      if (attachment.contentType === 'image/png' && attachment.path) {
        const base64 = fileToBase64(attachment.path);
        if (base64) {
          parts.push(`<img src="data:image/png;base64,${base64}" class="fr-fic fr-fil fr-dib">`);
        }
      }
      // else
      // if (attachment.contentType === 'video/webm' && attachment.path) {
      //   const base64 = fileToBase64(attachment.path);
      //   if (base64) {
      //     parts.push(`<video controls width="600">\n  <source type="video/webm" src="data:video/webm;base64,${base64}">\n  Your browser does not support the video tag.\n</video>`);
      //   }
      // }
    }
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * Determine which group keys to process based on project key filter
 * @param {Object} testExecutions - Parsed test execution data
 * @param {string} projectKey - Optional project key filter
 * @returns {string[]} Array of group keys to process
 */
export function determineGroupKeys(testExecutions, projectKey) {
  return projectKey ? [projectKey] : Object.keys(testExecutions.data);
}

/**
 * Get Zephyr configuration for a specific group key
 * @param {string} groupKey - The project/group key
 * @returns {Object|null} Zephyr configuration or null if not found
 */
export function getZephyrConfig(groupKey) {
  const zephyrConfigs = ZephyrAPI.getProjectConfigByKey(groupKey);
  if (!zephyrConfigs || zephyrConfigs.length === 0) {
    console.log(`Not a zephyr project: ${groupKey}`);
    return null;
  }
  return zephyrConfigs[0];
}

/**
 * Process a test group: create test cycle and execute all tests
 * @param {string} groupKey - The project key
 * @param {Array} tests - Array of test executions
 * @param {string} testCycleName - Name for the test cycle
 * @returns {Promise<Object|null>} Test cycle info with key and link, or null if not a zephyr project
 */
export async function processTestGroup(groupKey, tests, testCycleName) {
  const zephyrConfig = getZephyrConfig(groupKey);
  if (!zephyrConfig) {
    return null;
  }

  const testCycle = await createTestCycle(groupKey, testCycleName);
  console.log(`\n===== ${zephyrConfig.squad} =====`);
  console.log(`Processing ${tests.length} tests...`);

  await processTestsInBatches(tests, groupKey, testCycle.response.key, zephyrConfig.squad);

  return {
    key: testCycle.response.key,
    link: buildTestCycleLink(zephyrConfig.key, testCycle.response.key),
    squad: zephyrConfig.squad,
    members: zephyrConfig.members,
    summary: {
      total: tests.length,
      pass: tests.filter((val) => val.status === 'pass').length,
      fail: tests.filter((val) => val.status === 'fail').length
    }
  };
}

/**
 * Create a test cycle in Zephyr
 * @param {string} projectKey - The project key
 * @param {string} name - Test cycle name
 * @returns {Promise<Object>} Created test cycle response
 */
async function createTestCycle(projectKey, name) {
  const today = new Date().toISOString();
  const ownerId = env?.ZEPHYR?.ACCOUNT_ID;

  return await ZephyrAPI.createTestCycle({
    name,
    projectKey,
    ownerId,
    plannedStartDate: today,
    plannedEndDate: today
  });
}

/**
 * Build the test cycle URL for Zephyr
 * @param {string} projectKey - The project key
 * @param {string} testCycleKey - The test cycle key
 * @returns {string} Full URL to the test cycle
 */
export function buildTestCycleLink(projectKey, testCycleKey) {
  return `https://bfifinance.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${testCycleKey}`;
}

/**
 * Split array into chunks of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array[]} Array of chunked arrays
 */
export function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process tests in batches to avoid overwhelming the API
 * @param {Array} tests - Array of test executions
 * @param {string} projectKey - The project key
 * @param {string} testCycleKey - The test cycle key
 * @param {string} squadName - Squad name for logging
 * @returns {Promise<void>}
 */
export async function processTestsInBatches(tests, projectKey, testCycleKey, squadName = 'Unknown') {
  const testBatches = chunkArray(tests, BATCH_SIZE);
  const totalBatches = testBatches.length;
  let processedTests = 0;

  console.log(`Processing in ${totalBatches} batches (${BATCH_SIZE} tests per batch)`);

  for (let batchIndex = 0; batchIndex < testBatches.length; batchIndex++) {
    const batch = testBatches[batchIndex];

    await Promise.all(
      batch.map(testExecution => processTestExecution(testExecution, projectKey, testCycleKey))
    );

    processedTests += batch.length;
    const progress = ((processedTests / tests.length) * 100).toFixed(1);

    console.log(`[${squadName}] Progress: ${processedTests}/${tests.length} tests (${progress}%) - Batch ${batchIndex + 1}/${totalBatches}`);

    // Show rate limit status periodically
    if (batchIndex % 5 === 0 || batchIndex === testBatches.length - 1) {
      zephyrRateLimiter.logStatus(`[${squadName}]`);
    }
  }

  console.log(`[${squadName}] Completed processing ${processedTests} tests`);
}

/**
 * Process a single test execution with all its tags
 * @param {Object} testExecution - Test execution object
 * @param {string} projectKey - The project key
 * @param {string} testCycleKey - The test cycle key
 * @returns {Promise<void>}
 */
export async function processTestExecution(testExecution, projectKey, testCycleKey) {
  const projectKeys = ZephyrAPI.getListProjectKeys();

  const tagPromises = testExecution.tags.map(async (tag) => {
    const tagCode = tag.split('-')[0];

    if (projectKeys.includes(tagCode)) {
      const tcConfig = ZephyrAPI.getProjectConfigByKey(tagCode)[0];
      await createTestExecutionAndUpdateStatus(
        tag,
        projectKey,
        testCycleKey,
        testExecution.status,
        tcConfig,
        testExecution
      );
    }
  });

  await Promise.all(tagPromises);
}

/**
 * Create test execution and update test case status in Zephyr
 * @param {string} testCaseKey - The test case key
 * @param {string} projectKey - The project key
 * @param {string} testCycleKey - The test cycle key
 * @param {string} status - Test execution status
 * @param {Object} zephyrConfig - Zephyr configuration
 * @returns {Promise<void>}
 */
export async function createTestExecutionAndUpdateStatus(testCaseKey, projectKey, testCycleKey, status, zephyrConfig, testExecution = {}) {
  const statusId = status.includes('pass')
    ? zephyrConfig.tcStatus.automated
    : zephyrConfig.tcStatus.needMaintenance;

  const [executionResult] = await Promise.all([
    ZephyrAPI.createTestExecution({
      projectKey,
      testCaseKey,
      testCycleKey,
      statusName: status
    }),
    ZephyrAPI.updateTcStatusByTcKey(testCaseKey, { status: { id: statusId } })
  ]);

  const comment = buildComment(testExecution);
  if (comment) {
    const executionId = executionResult.response.id;
    await ZephyrAPI.updateTestExecution(executionId, {
      projectKey,
      testCaseKey,
      testCycleKey,
      statusName: status,
      comment
    });
  }
}

/**
 * Print test cycle summary to console with squad-specific details
 * @param {string} testcycleKey - Test cycle key
 * @param {string} testCycleLink - Test cycle URL link
 * @param {Object} summary - Test summary object with total, pass, fail counts
 * @returns {void}
 */
export function printTestCycleSummary(testcycleKey, testCycleLink, summary) {
  console.log(`TEST CYCLE KEY : ${testcycleKey}`);
  console.log(`TEST CYCLE LINK : ${testCycleLink}`);
  console.log(`TOTAL TEST EXECUTED : ${summary.total}`);
  console.log(`TOTAL PASSED TEST : ${summary.pass}`);
  console.log(`TOTAL FAILED TEST : ${summary.fail}`);
}

/**
 * Print test execution summary to console
 * @param {Object} summary - Test summary object with total, pass, fail counts
 * @returns {void}
 */
export function printSummary(summary) {
  console.log('===== SUMMARY =====');
  console.log(`TOTAL TEST EXECUTED : ${summary.total}`);
  console.log(`TOTAL PASSED TEST : ${summary.pass}`);
  console.log(`TOTAL FAILED TEST : ${summary.fail}`);
}

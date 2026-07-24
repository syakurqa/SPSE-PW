/* eslint-disable no-console */
import ZephyrAPI, { zephyrRateLimiter } from '../../integrations/zephyr-api.js';

/**
 * Validate a single test case ID against Zephyr API
 * @param {string} testCaseId - Test case ID (e.g., 'PBF2-T123')
 * @returns {Promise<Object>} Validation result with status and details
 */
export async function validateTestCase(testCaseId) {
  try {
    const response = await ZephyrAPI.getTestCaseByTestCaseKey(testCaseId);

    if (response.status === 200 && response.response) {
      return {
        testCaseId,
        valid: true,
        exists: true,
        details: {
          name: response.response.name,
          key: response.response.key,
          projectKey: response.response.project?.key
        }
      };
    }

    return {
      testCaseId,
      valid: false,
      exists: false,
      error: 'Test case not found'
    };
  } catch (error) {
    // Handle specific error cases
    if (error.statusCode === 404) {
      return {
        testCaseId,
        valid: false,
        exists: false,
        error: 'Test case does not exist in Zephyr'
      };
    }

    if (error.statusCode === 401 || error.statusCode === 403) {
      return {
        testCaseId,
        valid: false,
        exists: false,
        error: 'Authentication/Authorization error'
      };
    }

    return {
      testCaseId,
      valid: false,
      exists: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Validate multiple test case IDs in batches
 * @param {string[]} testCaseIds - Array of test case IDs
 * @param {number} batchSize - Number of concurrent validations
 * @returns {Promise<Object>} Validation results with valid and invalid arrays
 */
export async function validateTestCases(testCaseIds, batchSize = 10) {
  const results = {
    valid: [],
    invalid: [],
    total: testCaseIds.length
  };

  console.log(`\nValidating ${testCaseIds.length} unique test case IDs...`);
  console.log(`Processing in batches of ${batchSize}...\n`);

  // Split into batches to avoid overwhelming the API
  const batches = [];
  for (let i = 0; i < testCaseIds.length; i += batchSize) {
    batches.push(testCaseIds.slice(i, i + batchSize));
  }

  let processedCount = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(testCaseId => validateTestCase(testCaseId))
    );

    // Categorize results
    for (const result of batchResults) {
      if (result.valid) {
        results.valid.push(result);
      } else {
        results.invalid.push(result);
      }
    }

    processedCount += batch.length;
    const progress = ((processedCount / testCaseIds.length) * 100).toFixed(1);

    console.log(
      `Progress: ${processedCount}/${testCaseIds.length} (${progress}%) - ` +
      `Batch ${batchIndex + 1}/${batches.length}`
    );

    // Show rate limit status periodically
    if (batchIndex % 5 === 0 || batchIndex === batches.length - 1) {
      zephyrRateLimiter.logStatus('[Health Check]');
    }
  }

  return results;
}

/**
 * Print validation summary to console
 * @param {Object} validationResults - Results from validateTestCases
 * @param {Object[]} scanResults - Original scan results with file paths
 */
export function printValidationSummary(validationResults, scanResults) {
  console.log('\n' + '='.repeat(80));
  console.log('HEALTH CHECK SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nTotal Unique Test Case IDs Found: ${validationResults.total}`);
  console.log(`✓ Valid Test Cases: ${validationResults.valid.length}`);
  console.log(`✗ Invalid Test Cases: ${validationResults.invalid.length}`);

  if (validationResults.invalid.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('INVALID TEST CASES:');
    console.log('-'.repeat(80));

    for (const invalid of validationResults.invalid) {
      console.log(`\n✗ ${invalid.testCaseId}`);
      console.log(`  Error: ${invalid.error}`);

      // Find files containing this test case ID
      const filesWithId = scanResults.filter(scan =>
        scan.testCaseIds.includes(invalid.testCaseId)
      );

      if (filesWithId.length > 0) {
        console.log(`  Found in ${filesWithId.length} file(s):`);
        for (const file of filesWithId) {
          console.log(`    - ${file.filePath}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
}

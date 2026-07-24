import { getConnection } from './database.js';

let _validKeys = null;

async function getValidKeys() {
  if (_validKeys) return _validKeys;
  const db = getConnection();
  const squads = await db('squads').select('zephyr_key');
  _validKeys = squads.map(s => s.zephyr_key);
  return _validKeys;
}

const testCasePattern = /^([A-Z0-9]+)-T(\d+)$/;

function statusMap(status) {
  switch (status) {
  case 'passed':
    return 'pass';
  case 'failed':
    return 'fail';
  case 'skipped':
    return 'skip';
  case 'flaky':
    return 'flaky';
  default:
    return 'fail';
  }
}

/**
 * Extract valid Zephyr test case keys from tags.
 */
export async function extractTestCaseKeys(tags) {
  const validKeys = await getValidKeys();
  return tags.filter(tag => {
    const match = tag.match(testCasePattern);
    return match && validKeys.includes(match[1]);
  });
}

/**
 * Parse a Playwright JSON report into individual test case results.
 */
export async function parsePlaywrightReport(jsonData) {
  const results = [];

  async function traverseSuite(suite) {
    for (const spec of (suite.specs || [])) {
      for (const test of spec.tests) {
        const lastResult = test.results?.[test.results.length - 1] || {};
        const status = statusMap(lastResult.status);
        const duration = lastResult.duration || 0;
        const retryCount = test.results ? test.results.length - 1 : 0;

        let errorMessage = null;
        if (lastResult.errors && lastResult.errors.length > 0) {
          errorMessage = lastResult.errors
            .map(e => e.message || '')
            .join('\n')
            .substring(0, 2000);
        }

        const tags = spec.tags || [];
        const testCaseKeys = await extractTestCaseKeys(tags);

        for (const tcKey of testCaseKeys) {
          results.push({
            test_case_key: tcKey,
            test_case_title: spec.title,
            status,
            duration_ms: duration,
            error_message: errorMessage,
            retry_count: retryCount,
            tags: JSON.stringify(tags),
          });
        }
      }
    }

    for (const child of (suite.suites || [])) {
      await traverseSuite(child);
    }
  }

  for (const suite of jsonData.suites) {
    await traverseSuite(suite);
  }
  return results;
}

/**
 * Find squad config by Zephyr project key.
 */
export async function findSquadByProjectKey(projectKey) {
  const db = getConnection();
  return db('squads').where({ zephyr_key: projectKey }).first();
}

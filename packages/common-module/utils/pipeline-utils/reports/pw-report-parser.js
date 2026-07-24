import { zephyrConfig } from '../../../config/zephyr-config.js';

export function parseTestResults(jsonData) {
  const groupedResults = {};
  const unGroupData = [];
  let totalTests = 0;
  let totalPass = 0;
  let totalFail = 0;

  // Get valid zephyr project keys
  const validZephyrKeys = zephyrConfig.map(config => config.key);

  /**
   * Extract valid Zephyr project keys from test tags
   * @param {Array<string>} tags - Array of tags (e.g., ['critical', 'feature:submit', 'DMTM-T7239'])
   * @returns {Array<string>} - Array of valid project keys (e.g., ['DMTM'])
   */
  function extractProjectKeys(tags) {
    // Pattern matches: PROJECTKEY-T1234 (e.g., DMTM-T7239, ON2-T123)
    const testCasePattern = /^([A-Z0-9]+)-T(\d+)$/;
    const projectKeys = [];

    for (const tag of tags) {
      const match = tag.match(testCasePattern);
      if (match) {
        const projectKey = match[1];
        // Validate against zephyr config
        if (validZephyrKeys.includes(projectKey)) {
          projectKeys.push(projectKey);
        }
      }
    }

    return projectKeys;
  }

  function traverseSuite(suite) {
    suite.specs?.forEach(spec => {
      spec.tests.forEach(test => {
        const result = test.results?.[test.results.length - 1] || {};
        const status = statusMap(result.status);
        totalTests++;

        if (status === 'pass') totalPass++;
        if (status === 'fail') totalFail++;

        if (spec.tags && spec.tags.length > 0) {
          const projectKeys = extractProjectKeys(spec.tags);

          if (projectKeys.length === 0) {
            // eslint-disable-next-line no-console
            console.log(`[Warning] No valid Zephyr project key found in tags for test: "${spec.title}". Tags: ${spec.tags.join(', ')}`);
          } else {
            // Add test to all project groups it belongs to
            projectKeys.forEach(projectKey => {
              if (!groupedResults[projectKey]) {
                groupedResults[projectKey] = [];
              }

              groupedResults[projectKey].push({
                title: spec.title,
                status: status,
                tags: spec.tags || [],
                stdout: result.stdout || [],
                errors: result.errors || [],
                attachments: result.attachments || []
              });
            });
          }

          unGroupData.push({
            title: spec.title,
            status: status,
            tags: spec.tags || [],
            stdout: result.stdout || [],
            errors: result.errors || [],
            attachments: result.attachments || []
          });
        }
      });
    });

    suite.suites?.forEach(child => traverseSuite(child));
  }

  jsonData.suites.forEach(suite => traverseSuite(suite));

  const summary = {
    total: totalTests,
    pass: totalPass,
    fail: totalFail
  };

  return {
    summary,
    data: groupedResults,
    unGroupData: unGroupData
  };
}

function statusMap(status) {
  switch (status) {
  case 'failed':
    return 'fail';
  case 'passed':
    return 'pass';
  default:
    return 'fail';
  }
}

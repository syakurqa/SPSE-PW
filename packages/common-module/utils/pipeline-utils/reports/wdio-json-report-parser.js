export function parseTestResults(jsonData) {
  const groupedResults = {};
  const unGroupData = [];
  let totalTests = 0;
  let totalPass = 0;
  let totalFail = 0;

  // Recursively collect all tests from mochawesome suite tree
  function collectTests(suites) {
    const tests = [];
    for (const suite of (suites || [])) {
      if (Array.isArray(suite.tests)) tests.push(...suite.tests);
      if (Array.isArray(suite.suites)) tests.push(...collectTests(suite.suites));
    }
    return tests;
  }

  const allTests = [];
  for (const result of (jsonData?.results || [])) {
    if (Array.isArray(result.tests)) allTests.push(...result.tests);
    if (Array.isArray(result.suites)) allTests.push(...collectTests(result.suites));
  }

  // Deduplicate by primary Zephyr tag — driver.reloadSession() causes mochawesome
  // to create a duplicate suite entry for each test in a describe block, so the same
  // test can appear multiple times in the JSON. 'fail wins': if any occurrence failed,
  // keep that one so Zephyr reflects the real outcome.
  const dedupedMap = new Map();
  const untaggedTests = [];
  for (const test of allTests) {
    const tags = extractTags(test?.title);
    if (tags.length === 0) {
      untaggedTests.push(test);
      continue;
    }
    const key = tags[0];
    const prev = dedupedMap.get(key);
    if (!prev || (prev.state !== 'failed' && test?.state === 'failed')) {
      dedupedMap.set(key, test);
    }
  }
  const processableTests = [...dedupedMap.values(), ...untaggedTests];

  processableTests.forEach(test => {
    const status = statusMap(test?.state);
    totalTests++;

    if (status === 'pass') totalPass++;
    if (status === 'fail') totalFail++;

    const tags = extractTags(test?.title);
    if (tags.length > 0) {
      const tag = tags[0];
      const prefix = tag.split('-')[0];

      if (!groupedResults[prefix]) {
        groupedResults[prefix] = [];
      }

      groupedResults[prefix].push({
        title: test?.title || '',
        status,
        tags
      });

      unGroupData.push({
        title: test?.title || '',
        status,
        tags
      });
    }
  });

  const summary = {
    total: totalTests,
    pass: totalPass,
    fail: totalFail
  };

  return {
    summary,
    data: groupedResults,
    unGroupData
  };
}

export const parseWdioTestResults = parseTestResults;

function extractTags(testName) {
  if (!testName || typeof testName !== 'string') return [];

  return (testName.match(/@[A-Za-z0-9_-]+/g) || [])
    .map(tag => tag.trim().replace(/^@+/, ''))
    .filter(Boolean);
}

function statusMap(status) {
  switch (String(status).toLowerCase()) {
  case 'passed':
  case 'pass':
    return 'pass';
  case 'failed':
  case 'fail':
    return 'fail';
  default:
    return 'fail';
  }
}

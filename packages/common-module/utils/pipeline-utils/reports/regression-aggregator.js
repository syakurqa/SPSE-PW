/**
 * Pure aggregation logic for the manual regression cycle aggregator.
 *
 * Rule: a test case PASSES if it passed in at least one run; it FAILS only if
 * it failed in every run. Non-Pass/Fail results (Not Executed, Blocked, blank)
 * are ignored for the verdict and do not count towards totalRuns.
 *
 * This module is intentionally free of any API/IO imports so it can be
 * unit-tested in isolation.
 */

/**
 * Normalise a raw Execution.Result cell to 'Pass' | 'Fail' | 'Other'.
 * @param {*} value Raw cell value.
 * @returns {'Pass'|'Fail'|'Other'}
 */
export function normalizeResult(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'pass' || v === 'passed') return 'Pass';
  if (v === 'fail' || v === 'failed') return 'Fail';
  if (v === 'untested' || v === 'not executed' || v === 'skip' || v === 'skipped') return 'Not Executed';
  return 'Other';
}

/**
 * Aggregate parsed Excel rows into one verdict per test case.
 *
 * @param {Array<{testCaseKey: string, result: *, cycleKey?: string}>} rows
 * @param {string[]} validProjectKeys Project key prefixes accepted by Zephyr.
 * @returns {{
 *   results: Array<{testCaseKey: string, projectKey: string, verdict: 'Pass'|'Fail',
 *                   passCount: number, failCount: number, totalRuns: number, unstable: boolean}>,
 *   skippedInvalidKey: number,
 *   skippedNoKey: number,
 *   zeroRunKeys: string[]
 * }}
 */
export function aggregateRows(rows, validProjectKeys) {
  const groups = new Map();
  let skippedInvalidKey = 0;
  let skippedNoKey = 0;

  for (const row of rows) {
    const testCaseKey = String(row.testCaseKey ?? '').trim();
    if (!testCaseKey) {
      skippedNoKey++;
      continue;
    }

    // The project key is the prefix before the first '-' (e.g. DM-T658 -> DM),
    // matching how processTestExecution derives the project from a tag.
    const projectKey = testCaseKey.split('-')[0];
    if (!validProjectKeys.includes(projectKey)) {
      skippedInvalidKey++;
      continue;
    }

    if (!groups.has(testCaseKey)) {
      groups.set(testCaseKey, {
        testCaseKey,
        projectKey,
        passCount: 0,
        failCount: 0,
        untestedCount: 0,
        totalRowCount: 0
      });
    }

    const group = groups.get(testCaseKey);
    const result = normalizeResult(row.result);
    group.totalRowCount++;
    if (result === 'Pass') group.passCount++;
    else if (result === 'Fail') group.failCount++;
    else if (result === 'Not Executed') group.untestedCount++;
    // 'Other' is ignored for the verdict and for totalRuns.
  }

  const results = [];
  const zeroRunKeys = [];

  for (const group of groups.values()) {
    const totalRuns = group.passCount + group.failCount;
    if (totalRuns === 0) {
      // Single untested row: include in the cycle as Not Executed.
      if (group.totalRowCount === 1 && group.untestedCount === 1) {
        results.push({
          testCaseKey: group.testCaseKey,
          projectKey: group.projectKey,
          verdict: 'Not Executed',
          passCount: 0,
          failCount: 0,
          totalRuns: 0,
          unstable: false
        });
      } else {
        zeroRunKeys.push(group.testCaseKey);
      }
      continue;
    }

    const verdict = group.passCount >= 1 ? 'Pass' : 'Fail';
    const unstable = verdict === 'Pass' && group.passCount < totalRuns;

    results.push({
      testCaseKey: group.testCaseKey,
      projectKey: group.projectKey,
      verdict,
      passCount: group.passCount,
      failCount: group.failCount,
      totalRuns,
      unstable
    });
  }

  return {
    results,
    skippedInvalidKey,
    skippedNoKey,
    zeroRunKeys
  };
}

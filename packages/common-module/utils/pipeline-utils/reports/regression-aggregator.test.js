import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRows, normalizeResult } from './regression-aggregator.js';

const VALID_KEYS = ['DM', 'ON2'];

function row(testCaseKey, result, cycleKey = 'DM-R1') {
  return {
    testCaseKey,
    result,
    cycleKey
  };
}

test('passes if at least one run passed (4 pass, 1 fail -> Pass)', () => {
  const rows = [
    row('DM-T1', 'Pass'),
    row('DM-T1', 'Pass'),
    row('DM-T1', 'Pass'),
    row('DM-T1', 'Pass'),
    row('DM-T1', 'Fail')
  ];
  const { results } = aggregateRows(rows, VALID_KEYS);
  assert.equal(results.length, 1);
  const r = results[0];
  assert.equal(r.verdict, 'Pass');
  assert.equal(r.passCount, 4);
  assert.equal(r.failCount, 1);
  assert.equal(r.totalRuns, 5);
  assert.equal(r.unstable, true);
});

test('fails only if every run failed (0 pass, 5 fail -> Fail)', () => {
  const rows = [
    row('DM-T2', 'Fail'),
    row('DM-T2', 'Fail'),
    row('DM-T2', 'Fail'),
    row('DM-T2', 'Fail'),
    row('DM-T2', 'Fail')
  ];
  const { results } = aggregateRows(rows, VALID_KEYS);
  assert.equal(results.length, 1);
  const r = results[0];
  assert.equal(r.verdict, 'Fail');
  assert.equal(r.passCount, 0);
  assert.equal(r.failCount, 5);
  assert.equal(r.totalRuns, 5);
  assert.equal(r.unstable, false);
});

test('a clean pass-every-run is not unstable', () => {
  const rows = [row('DM-T3', 'Pass'), row('DM-T3', 'Pass')];
  const { results } = aggregateRows(rows, VALID_KEYS);
  assert.equal(results[0].verdict, 'Pass');
  assert.equal(results[0].unstable, false);
});

test('non Pass/Fail values are ignored for verdict and totalRuns', () => {
  const rows = [
    row('DM-T4', 'Pass'),
    row('DM-T4', 'Not Executed'),
    row('DM-T4', 'Blocked'),
    row('DM-T4', '')
  ];
  const { results } = aggregateRows(rows, VALID_KEYS);
  const r = results[0];
  assert.equal(r.verdict, 'Pass');
  assert.equal(r.passCount, 1);
  assert.equal(r.failCount, 0);
  assert.equal(r.totalRuns, 1, 'Other results must not inflate totalRuns');
  assert.equal(r.unstable, false);
});

test('a test case with only non-Pass/Fail rows is skipped (zeroRunKeys)', () => {
  const rows = [row('DM-T5', 'Not Executed'), row('DM-T5', 'Blocked')];
  const { results, zeroRunKeys } = aggregateRows(rows, VALID_KEYS);
  assert.equal(results.length, 0);
  assert.deepEqual(zeroRunKeys, ['DM-T5']);
});

test('rows with a non-Zephyr project key prefix are skipped', () => {
  const rows = [
    row('DM-T6', 'Pass'),
    row('XYZ-T1', 'Pass'),
    row('XYZ-T1', 'Fail')
  ];
  const { results, skippedInvalidKey } = aggregateRows(rows, VALID_KEYS);
  assert.equal(results.length, 1);
  assert.equal(results[0].testCaseKey, 'DM-T6');
  assert.equal(skippedInvalidKey, 2);
});

test('rows with no test case key are skipped', () => {
  const rows = [row('', 'Pass'), row('   ', 'Fail'), row('DM-T7', 'Pass')];
  const { results, skippedNoKey } = aggregateRows(rows, VALID_KEYS);
  assert.equal(results.length, 1);
  assert.equal(skippedNoKey, 2);
});

test('groups independently by key and supports multiple projects', () => {
  const rows = [
    row('DM-T8', 'Fail'),
    row('DM-T8', 'Pass'),
    row('ON2-T1', 'Fail'),
    row('ON2-T1', 'Fail')
  ];
  const { results } = aggregateRows(rows, VALID_KEYS);
  const byKey = Object.fromEntries(results.map(r => [r.testCaseKey, r]));
  assert.equal(byKey['DM-T8'].verdict, 'Pass');
  assert.equal(byKey['DM-T8'].projectKey, 'DM');
  assert.equal(byKey['ON2-T1'].verdict, 'Fail');
  assert.equal(byKey['ON2-T1'].projectKey, 'ON2');
});

test('normalizeResult is case-insensitive and handles synonyms', () => {
  assert.equal(normalizeResult('pass'), 'Pass');
  assert.equal(normalizeResult(' PASSED '), 'Pass');
  assert.equal(normalizeResult('Fail'), 'Fail');
  assert.equal(normalizeResult('failed'), 'Fail');
  assert.equal(normalizeResult('Not Executed'), 'Other');
  assert.equal(normalizeResult(null), 'Other');
  assert.equal(normalizeResult(undefined), 'Other');
});

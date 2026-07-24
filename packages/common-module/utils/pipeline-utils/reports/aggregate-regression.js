/* eslint-disable no-console */
// Manual Regression Cycle Aggregator
// API Doc: https://support.smartbear.com/zephyr-scale-cloud/api-docs
//
// Reads several Zephyr Excel exports from a folder, aggregates them with a
// "best result wins" rule (a test case passes if it passed in >= 1 run; it
// fails only if it failed in every run), and creates ONE consolidated
// regression test cycle in Zephyr.
//
// Manual run only. Reuses the existing ZephyrAPI client (auth, rate limiting,
// error handling). Original per-run cycles are never touched.

import args from 'args';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import ZephyrAPI, { zephyrRateLimiter } from '../../integrations/zephyr-api.js';
import { env } from '../../../config/index.js';
import { buildTestCycleLink, chunkArray } from './test-cycle-helpers.js';
import { aggregateRows } from './regression-aggregator.js';

const BATCH_SIZE = 50;

// Header candidates per logical column. Zephyr Excel exports use dotted
// headers (e.g. "Test Case.Key"); we accept common variants defensively.
const COLUMN_CANDIDATES = {
  testCaseKey: ['Test Case.Key', 'Test Case Key', 'testCaseKey'],
  result: ['Execution.Result', 'Execution Result', 'Result'],
  cycleKey: ['Test Cycle.Key', 'Test Cycle Key', 'testCycleKey']
};

args
  .option('input', 'Folder containing (or path to) the Zephyr Excel (.xlsx) export(s)')
  .option('project-key', 'Target Zephyr project key for the new regression cycle')
  .option('name', 'Name for the new regression cycle')
  .option('dry-run', 'Aggregate and print the summary without writing to Zephyr', false);

function defaultCycleName() {
  const date = new Date().toISOString().slice(0, 10);
  return `Regression (aggregated) - ${date}`;
}

/**
 * Find a field value in a raw row by trying header candidates (case-insensitive).
 * @param {Object} rawRow
 * @param {string[]} candidates
 * @returns {*}
 */
function getField(rawRow, candidates) {
  const keys = Object.keys(rawRow);
  for (const candidate of candidates) {
    const match = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (match !== undefined) return rawRow[match];
  }
  return undefined;
}

/**
 * List .xlsx files from a folder or a single file path.
 * Ignores Excel lock files like ~$name.xlsx.
 * @param {string} input Folder path or single .xlsx file path.
 * @returns {string[]} Absolute file paths, sorted.
 */
function listExcelFiles(input) {
  if (!fs.existsSync(input)) {
    throw new Error(`[ERROR] Input not found: ${input}`);
  }
  const stat = fs.statSync(input);
  if (stat.isFile()) {
    if (!/\.xlsx$/i.test(input)) throw new Error(`[ERROR] Input file is not an .xlsx file: ${input}`);
    return [path.resolve(input)];
  }
  return fs.readdirSync(input)
    .filter(f => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .map(f => path.resolve(input, f))
    .sort();
}

/**
 * Read the first sheet of an Excel file into normalised rows.
 * @param {string} filePath
 * @returns {Array<{testCaseKey: *, result: *, cycleKey: *}>}
 */
function readExcelRows(filePath) {
  // Read bytes via fs and use xlsx.read — the ESM build of SheetJS does not
  // auto-wire fs, so xlsx.readFile() is unavailable here.
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  return json.map(raw => ({
    testCaseKey: getField(raw, COLUMN_CANDIDATES.testCaseKey),
    result: getField(raw, COLUMN_CANDIDATES.result),
    cycleKey: getField(raw, COLUMN_CANDIDATES.cycleKey)
  }));
}

/**
 * Create the single consolidated regression cycle.
 */
async function createRegressionCycle(projectKey, name) {
  const today = new Date().toISOString();
  const ownerId = env?.ZEPHYR?.ACCOUNT_ID;

  return ZephyrAPI.createTestCycle({
    name,
    projectKey,
    ownerId,
    plannedStartDate: today,
    plannedEndDate: today
  });
}

/**
 * Phase 1: write one execution per test case into the new cycle, batched.
 * Uses createTestExecution only — avoids updateTestExecution and its 20s sleep.
 */
async function writeExecutions(results, projectKey, testCycleKey) {
  const batches = chunkArray(results, BATCH_SIZE);
  let processed = 0;

  console.log(`\n[Executions] Writing ${results.length} execution(s) in ${batches.length} batch(es)...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await Promise.all(batch.map(r => ZephyrAPI.createTestExecution({
      projectKey,
      testCaseKey: r.testCaseKey,
      testCycleKey,
      statusName: r.verdict
    })));

    processed += batch.length;
    console.log(`[Executions] ${processed}/${results.length} (batch ${i + 1}/${batches.length})`);

    if (i % 5 === 0 || i === batches.length - 1) {
      zephyrRateLimiter.logStatus('[Regression]');
    }
  }
}

/**
 * Phase 2 (LAST): assert each test case's own status from the aggregated
 * verdict — Pass -> automated, Fail -> needMaintenance. One write per case,
 * done after all executions so a flaky-but-ultimately-Pass case is never left
 * marked "Need Maintenance" (Caution A).
 */
async function assertFinalStatuses(results) {
  const batches = chunkArray(results, BATCH_SIZE);
  let processed = 0;

  console.log(`\n[Status] Asserting final status for ${results.length} test case(s)...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    await Promise.all(batch.map(r => {
      if (r.verdict === 'Not Executed') return Promise.resolve();
      const tcConfig = ZephyrAPI.getProjectConfigByKey(r.projectKey)?.[0];
      if (!tcConfig?.tcStatus) {
        console.log(`[Warning] No tcStatus config for project "${r.projectKey}"; skipping status assertion for ${r.testCaseKey}.`);
        return Promise.resolve();
      }
      const statusId = r.verdict === 'Pass'
        ? tcConfig.tcStatus.automated
        : tcConfig.tcStatus.needMaintenance;
      return ZephyrAPI.updateTcStatusByTcKey(r.testCaseKey, { status: { id: statusId } });
    }));

    processed += batch.length;
    console.log(`[Status] ${processed}/${results.length} (batch ${i + 1}/${batches.length})`);

    if (i % 5 === 0 || i === batches.length - 1) {
      zephyrRateLimiter.logStatus('[Regression]');
    }
  }
}

function printAggregationSummary({
  fileCount, rowCount, results
}) {
  const pass = results.filter(r => r.verdict === 'Pass').length;
  const fail = results.filter(r => r.verdict === 'Fail').length;
  const notExecuted = results.filter(r => r.verdict === 'Not Executed').length;
  const unstable = results.filter(r => r.unstable);

  console.log('\n===== AGGREGATION SUMMARY =====');
  console.log(`Input files          : ${fileCount}`);
  console.log(`Rows read            : ${rowCount}`);
  console.log(`Test cases           : ${results.length}`);
  console.log(`Final verdict        : ${pass} Pass / ${fail} Fail / ${notExecuted} Not Executed`);
  console.log(`Unstable (pass<runs) : ${unstable.length}`);
  for (const r of unstable) {
    console.log(`  ${r.testCaseKey}  ${r.passCount}/${r.totalRuns}`);
  }
}

async function main() {
  const flags = args.parse(process.argv);
  const inputDir = flags.input;
  const projectKey = flags.projectKey;
  const cycleName = flags.name || defaultCycleName();
  const dryRun = Boolean(flags.dryRun);

  if (!inputDir) throw new Error('[ERROR] --input folder is required.');
  if (!projectKey) throw new Error('[ERROR] --project-key is required.');

  const validProjectKeys = ZephyrAPI.getListProjectKeys();

  const files = listExcelFiles(inputDir);
  if (files.length === 0) {
    throw new Error(`[ERROR] No .xlsx files found in ${inputDir}`);
  }

  let allRows = [];
  for (const file of files) {
    const rows = readExcelRows(file);
    console.log(`[Read] ${path.basename(file)} -> ${rows.length} row(s)`);
    allRows = allRows.concat(rows);
  }

  const {
    results, skippedInvalidKey, skippedNoKey, zeroRunKeys
  } = aggregateRows(allRows, validProjectKeys);

  if (skippedNoKey > 0) {
    console.log(`[Warning] Skipped ${skippedNoKey} row(s) with no Test Case key.`);
  }
  if (skippedInvalidKey > 0) {
    console.log(`[Warning] Skipped ${skippedInvalidKey} row(s) whose project key prefix is not a known Zephyr project.`);
  }
  for (const key of zeroRunKeys) {
    console.log(`[Warning] ${key} had rows but no Pass/Fail result — skipped (nothing to assert).`);
  }

  printAggregationSummary({
    fileCount: files.length,
    rowCount: allRows.length,
    results
  });

  if (results.length === 0) {
    console.log('\n[Info] No test cases with a Pass/Fail verdict. Nothing to write.');
    return;
  }

  if (dryRun) {
    console.log('\n[Dry-run] No cycle or executions were created.');
    return;
  }

  const cycle = await createRegressionCycle(projectKey, cycleName);
  const testCycleKey = cycle.response.key;

  await writeExecutions(results, projectKey, testCycleKey);
  await assertFinalStatuses(results);

  console.log(`\nNew cycle        : ${testCycleKey}`);
  console.log(`Cycle link       : ${buildTestCycleLink(projectKey, testCycleKey)}`);
}

main().catch(error => {
  console.error('Error running regression aggregator:', error.message || error);
  process.exit(1);
});

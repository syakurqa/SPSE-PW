/* eslint-disable no-console */
/**
 * Execution Result Writer
 *
 * Parses Playwright JSON report and writes individual test case results
 * to PostgreSQL for success/failure rate tracking.
 *
 * Usage: npm run execution:write --workspace=@automation/reporting-module -- -- \
 *   --report-file-name="test-api-1-results.json" --type=api --trigger-type=scheduled
 */

import { execSync } from 'node:child_process';
import args from 'args';
import fs from 'fs';
import path from 'path';
import { getConnection, destroyConnection } from '../lib/database.js';
import { parsePlaywrightReport } from '../lib/report-parser.js';

args
  .option('report-file-name', 'Playwright JSON report file name')
  .option('type', 'Workspace type: api, web, or mobile')
  .option('trigger-type', 'Trigger type: scheduled, manual, or pr', 'scheduled')
  .option('date', 'Execution date (YYYY-MM-DD). Defaults to now.');

async function writeExecutionResults() {
  const argv = process.argv.filter(a => a !== '--');
  const flags = args.parse(argv);

  if (!flags.reportFileName || !flags.type) {
    throw new Error('--report-file-name and --type are required');
  }

  if (flags.date && !/^\d{4}-\d{2}-\d{2}$/.test(flags.date)) {
    throw new Error(`Invalid --date format: "${flags.date}". Expected YYYY-MM-DD.`);
  }

  const runStartedAt = flags.date ? `${flags.date}T00:00:00.000Z` : new Date().toISOString();
  const runCompletedAt = flags.date ? `${flags.date}T23:59:59.999Z` : new Date().toISOString();

  const reportDirName = flags.type === 'mobile' ? 'reports' : 'playwright-report';
  const repoRoot = path.resolve(process.env.REPO_ROOT || execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim());
  const reportPath = path.resolve(
    repoRoot,
    `packages/${flags.type}-automation/${reportDirName}/${flags.reportFileName}`
  );

  if (!fs.existsSync(reportPath)) {
    console.log(`⚠️  Report file not found: ${reportPath}. Skipping execution tracking.`);
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const testResults = await parsePlaywrightReport(jsonData);

  if (testResults.length === 0) {
    console.log('No test results with valid Zephyr tags found. Skipping.');
    return;
  }

  const db = getConnection();

  const [syncLogEntry] = await db('sync_log')
    .insert({
      sync_type: 'EXECUTION_SYNC',
      status: 'STARTED',
    })
    .returning('*');

  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const failedTests = testResults.filter(r => r.status === 'fail').length;
  const skippedTests = testResults.filter(r => r.status === 'skip').length;

  const [executionRun] = await db('execution_runs')
    .insert({
      run_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
      run_number: parseInt(process.env.GITHUB_RUN_NUMBER) || null,
      run_attempt: parseInt(process.env.GITHUB_RUN_ATTEMPT) || 1,
      test_environment: process.env.ENV || 'SIT',
      trigger_type: flags.triggerType,
      branch_name: process.env.GITHUB_REF_NAME || null,
      workspace_type: flags.type,
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: failedTests,
      skipped_tests: skippedTests,
      started_at: runStartedAt,
      completed_at: runCompletedAt,
      zephyr_test_cycle_key: null,
    })
    .onConflict(['run_id', 'run_attempt', 'workspace_type'])
    .merge({
      run_number: db.raw('EXCLUDED.run_number'),
      test_environment: db.raw('EXCLUDED.test_environment'),
      trigger_type: db.raw('EXCLUDED.trigger_type'),
      branch_name: db.raw('EXCLUDED.branch_name'),
      total_tests: db.raw('execution_runs.total_tests + EXCLUDED.total_tests'),
      passed_tests: db.raw('execution_runs.passed_tests + EXCLUDED.passed_tests'),
      failed_tests: db.raw('execution_runs.failed_tests + EXCLUDED.failed_tests'),
      skipped_tests: db.raw('execution_runs.skipped_tests + EXCLUDED.skipped_tests'),
      started_at: db.raw('LEAST(execution_runs.started_at, EXCLUDED.started_at)'),
      completed_at: db.raw('GREATEST(execution_runs.completed_at, EXCLUDED.completed_at)'),
      zephyr_test_cycle_key: db.raw('COALESCE(EXCLUDED.zephyr_test_cycle_key, execution_runs.zephyr_test_cycle_key)'),
    })
    .returning('*');

  console.log(`\n✅ Execution run recorded: ${executionRun.run_id}`);
  console.log(`   Total: ${totalTests} | Pass: ${passedTests} | Fail: ${failedTests} | Skip: ${skippedTests}`);

  const BATCH_SIZE = 100;
  for (let i = 0; i < testResults.length; i += BATCH_SIZE) {
    const batch = testResults.slice(i, i + BATCH_SIZE).map(r => ({
      execution_run_id: executionRun.id,
      created_at: runStartedAt,
      ...r,
    }));
    await db('execution_results').insert(batch);
  }

  console.log(`   📊 ${testResults.length} individual test results stored`);

  await db('sync_log').where({ id: syncLogEntry.id }).update({
    status: 'COMPLETED',
    details: JSON.stringify({
      run_id: executionRun.run_id,
      total: totalTests,
      pass: passedTests,
      fail: failedTests,
    }),
    completed_at: new Date().toISOString(),
  });

  destroyConnection();
}

writeExecutionResults().catch(err => {
  console.error('Execution result writing failed:', err);
  destroyConnection();
  process.exit(1);
});

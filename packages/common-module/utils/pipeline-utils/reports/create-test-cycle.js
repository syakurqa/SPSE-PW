/* eslint-disable no-console */
import args from 'args';
import fs from 'fs';
import path from 'path';
import { parseTestResults as parsePwTestResults } from './pw-report-parser.js';
import { parseTestResults as parseWdioTestResults } from './wdio-json-report-parser.js';
import { automationReportNotif } from '../../integrations/google-chat.js';
import * as TestCycleHelpers from './test-cycle-helpers.js';

const DEFAULT_REPORT_FILE_NAME = 'default.json';
const DEFAULT_TEST_CYCLE_NAME = 'Automation Test Execution';

// Configure CLI arguments
args
  .option('report-file-name', 'Report file name (single)', DEFAULT_REPORT_FILE_NAME)
  .option('report-file-names', 'Comma-separated report file names for multi-report processing', '')
  .option('type', 'api, web, or mobile')
  .option('project-key', 'Zephyr project key')
  .option('test-cycle-name', 'Test cycle name', DEFAULT_TEST_CYCLE_NAME);

async function main() {
  const flags = args.parse(process.argv);

  // Multi-report path: --report-file-names=file1.json,file2.json,...
  if (flags.reportFileNames) {
    return mainMulti(flags);
  }

  // Single-file path (existing behaviour — unchanged)
  validateFlags(flags);
  const reportPath = getReportPath(flags.type, flags.reportFileName);
  const testExecutions = await loadAndParseTestResults(reportPath, flags.type);
  const groupKeys = TestCycleHelpers.determineGroupKeys(testExecutions, flags.projectKey);
  if (flags.projectKey) {
    testExecutions.data[flags.projectKey] = testExecutions.unGroupData;
  }
  TestCycleHelpers.printSummary(testExecutions.summary);

  for (const groupKey of groupKeys) {
    const cycleInfo = await TestCycleHelpers.processTestGroup(
      groupKey,
      testExecutions.data[groupKey],
      flags.testCycleName
    );

    if (cycleInfo) {
      TestCycleHelpers.printTestCycleSummary(cycleInfo.key, cycleInfo.link, cycleInfo.summary);
      if (process.env.CI === 'true') {
        await sendNotification({
          testCycles: {
            key: cycleInfo.key,
            link: cycleInfo.link
          },
          testType: flags.type,
          summary: cycleInfo.summary,
          squad: cycleInfo.squad,
          members: cycleInfo.members,
          reportLabel: testExecutions.reportLabel || null
        });
      }
    }
  }
}

async function mainMulti(flags) {
  if (!flags.type) throw new Error('[ERROR] type is missing.');
  if (!flags.testCycleName) throw new Error('[ERROR] test-cycle-name is missing.');

  const fileNames = flags.reportFileNames.split(',').map(f => f.trim()).filter(Boolean);
  if (fileNames.length === 0) throw new Error('[ERROR] report-file-names is empty.');

  console.log(`[Multi] Processing ${fileNames.length} report file(s)...`);

  // Accumulate per-report entries for a single combined notification
  const subReports = [];
  let firstMembers = null;
  let firstSquad = null;

  for (const fileName of fileNames) {
    const reportPath = getReportPath(flags.type, fileName);
    const testExecutions = await loadAndParseTestResults(reportPath, flags.type);
    const groupKeys = TestCycleHelpers.determineGroupKeys(testExecutions, flags.projectKey);
    if (flags.projectKey) {
      testExecutions.data[flags.projectKey] = testExecutions.unGroupData;
    }
    TestCycleHelpers.printSummary(testExecutions.summary);

    for (const groupKey of groupKeys) {
      const cycleInfo = await TestCycleHelpers.processTestGroup(
        groupKey,
        testExecutions.data[groupKey],
        testExecutions.reportLabel ? testExecutions.reportLabel : flags.testCycleName
      );

      if (cycleInfo) {
        TestCycleHelpers.printTestCycleSummary(cycleInfo.key, cycleInfo.link, cycleInfo.summary);
        if (!firstSquad) firstSquad = cycleInfo.squad;
        if (!firstMembers) firstMembers = cycleInfo.members;

        subReports.push({
          label: testExecutions.reportLabel || fileName,
          summary: cycleInfo.summary,
          cycleKey: cycleInfo.key,
          cycleLink: cycleInfo.link
        });
      }
    }
  }

  if (process.env.CI === 'true' && subReports.length > 0) {
    // Grand total across all reports
    const grandTotal = subReports.reduce((acc, r) => {
      acc.total += r.summary.total;
      acc.pass  += r.summary.pass;
      acc.fail  += r.summary.fail;
      return acc;
    }, {
      total: 0,
      pass: 0,
      fail: 0
    });

    await sendNotification({
      testCycles: {
        key: subReports[0].cycleKey,
        link: subReports[0].cycleLink
      },
      testType: flags.type,
      summary: grandTotal,
      squad: firstSquad,
      members: firstMembers,
      subReports
    });
  }
}

function validateFlags(flagsToValidate) {
  if (!flagsToValidate.type) {
    throw new Error('[ERROR] type is missing.');
  }

  if (!flagsToValidate.reportFileName) {
    throw new Error('[ERROR] report-file-name is missing.');
  }
}

function getReportPath(type, reportFileName) {
  const reportDirName = type === 'mobile' ? 'reports' : 'playwright-report';
  return path.resolve(`../../packages/${type}-automation/${reportDirName}/${reportFileName}`);
}

async function loadAndParseTestResults(pathToReport, type) {
  const jsonData = fs.readFileSync(pathToReport, 'utf8');
  const parsedData = JSON.parse(jsonData);

  const parser = type === 'mobile' ? parseWdioTestResults : parsePwTestResults;
  const parsed = parser(parsedData);

  if (type === 'mobile') {
    // mochawesome merged reports store device name under meta.deviceName
    parsed.reportLabel = parsedData.meta?.deviceName || null;
  }

  return parsed;
}

async function sendNotification({
  testCycles, testType, summary, squad, members, reportLabel, subReports
}) {
  await automationReportNotif({
    testEnvironment: process.env.ENV,
    squadName: squad,
    workspaceType: testType,
    actor: process.env.GITHUB_ACTOR,
    executionType: process.env.EXECUTION_TYPE,
    keyword: process.env.KEYWORD,
    runNumber: process.env.GITHUB_RUN_NUMBER,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    branchName: process.env.GITHUB_REF_NAME,
    workflowRunUrl: process.env.GITHUB_WORKFLOW,
    testSummary: {
      total: String(summary.total),
      pass: String(summary.pass),
      fail: String(summary.fail)
    },
    testCycles,
    mentions: members ? Object.values(members) : [],
    scheduler: process.env.SCHEDULER,
    reportLabel: reportLabel || null,
    subReports: subReports || null
  });
}

// Execute main function
main().catch(error => {
  console.error('Error executing test cycle creation:', error);
  process.exit(1);
});


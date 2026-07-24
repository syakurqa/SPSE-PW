#!/usr/bin/env node
/* eslint-disable no-console */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  scanFiles,
  getJsFilesRecursive,
  getGitDiffFiles,
  filterIgnoredFiles
} from '../test-case-check/test-case-scanner.js';
import {
  buildTestCaseMap,
  findDuplicates,
  checkNewDuplicates,
  printDuplicateSummary,
  printGitDiffDuplicateSummary
} from './duplicate-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get workspace root (5 levels up from utils/pipeline-utils/unique-test-case-check)
const WORKSPACE_ROOT = resolve(__dirname, '../../../../../');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  const config = {
    mode: null,
    branch1: null,
    branch2: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--all') {
      config.mode = 'all';
    } else if (arg === '--git-diff') {
      config.mode = 'git-diff';
      // Expect one or two branch names
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        config.branch1 = args[i + 1];
        i += 1;
        // Check if there's a second branch
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          config.branch2 = args[i + 1];
          i += 1;
        } else {
          config.branch2 = null;
        }
      } else {
        throw new Error('--git-diff requires at least one branch name (e.g., --git-diff main or --git-diff main feature/my-branch)');
      }
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!config.mode) {
    throw new Error('No mode specified. Use --all or --git-diff');
  }

  return config;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Unique Test Case Check - Detect Duplicate Test Case IDs

Usage:
  npm run check:unique-testcase -- [options]

Options:
  --all                           Check all .js files for duplicate test case IDs
  --git-diff <branch> [branch2]   Check if changed files introduce duplicates
  -h, --help                      Show this help message

Examples:
  # Check all files for duplicates
  npm run check:unique-testcase -- --all

  # Check current changes against main branch
  npm run check:unique-testcase -- --git-diff main

  # Check if changes introduce duplicates (compare branches)
  npm run check:unique-testcase -- --git-diff main feature/new-tests

  # Check current changes against origin/main
  npm run check:unique-testcase -- --git-diff origin/main HEAD

Description:
  This tool scans for test case IDs (e.g., @PBF2-T1237) and detects duplicates:
  - Flags test case IDs appearing in multiple files
  - Flags test case IDs appearing multiple times in the same file
  - For git-diff mode: checks if changed files introduce duplicates against ALL files
  
  Exit Codes:
  - 0: No duplicates found
  - 1: Duplicates detected (fails the check)
`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('UNIQUE TEST CASE CHECK');
    console.log('='.repeat(80));

    // Parse arguments
    const config = parseArgs();

    if (config.mode === 'all') {
      // Scan all files and check for duplicates
      console.log('\nScanning all .js files in workspace...');
      const allFiles = filterIgnoredFiles(getJsFilesRecursive(WORKSPACE_ROOT));

      if (allFiles.length === 0) {
        console.log('\n⚠️  No .js files found to scan.');
        process.exit(0);
      }

      console.log(`Found ${allFiles.length} .js file(s) to scan.\n`);
      console.log('Scanning files for test case IDs...');

      const scanResults = scanFiles(allFiles);

      if (scanResults.length === 0) {
        console.log('\n✓ No test case IDs found in scanned files.');
        process.exit(0);
      }

      console.log(`Found test case IDs in ${scanResults.length} file(s).`);

      // Build test case map and find duplicates
      const testCaseMap = buildTestCaseMap(scanResults);
      const results = findDuplicates(testCaseMap);

      // Print summary
      printDuplicateSummary(results, scanResults.length);

      // Exit with error if duplicates found
      if (results.duplicates.length > 0) {
        console.log(`\n❌ Duplicate check FAILED: ${results.duplicates.length} duplicate test case ID(s) found.`);
        process.exit(1);
      } else {
        console.log('\n✅ Duplicate check PASSED: All test case IDs are unique.');
        process.exit(0);
      }
    } else if (config.mode === 'git-diff') {
      // Get changed files
      console.log(`\nGetting files changed between ${config.branch1} and ${config.branch2}...`);
      const changedFiles = getGitDiffFiles(config.branch1, config.branch2, WORKSPACE_ROOT);

      if (changedFiles.length === 0) {
        console.log('\n⚠️  No .js files changed between the branches.');
        process.exit(0);
      }

      console.log(`Found ${changedFiles.length} changed .js file(s).\n`);

      // Scan changed files
      console.log('Scanning changed files for test case IDs...');
      const changedScanResults = scanFiles(changedFiles);

      if (changedScanResults.length === 0) {
        console.log('\n✓ No test case IDs found in changed files.');
        process.exit(0);
      }

      console.log(`Found test case IDs in ${changedScanResults.length} changed file(s).`);

      // Scan ALL files in the project
      console.log('\nScanning all files in project for comparison...');
      const allFiles = filterIgnoredFiles(getJsFilesRecursive(WORKSPACE_ROOT));
      const allScanResults = scanFiles(allFiles);
      console.log(`Scanned ${allScanResults.length} file(s) in total.`);

      // Check for duplicates
      const results = checkNewDuplicates(changedScanResults, allScanResults);

      // Print summary
      printGitDiffDuplicateSummary(results);

      // Exit with error if duplicates found
      if (results.newDuplicates.length > 0) {
        console.log(`\n❌ Duplicate check FAILED: ${results.newDuplicates.length} duplicate test case ID(s) detected.`);
        process.exit(1);
      } else {
        console.log('\n✅ Duplicate check PASSED: No duplicates introduced by changes.');
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main();

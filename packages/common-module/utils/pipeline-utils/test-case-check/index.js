#!/usr/bin/env node
/* eslint-disable no-console */

import { fileURLToPath } from 'url';
import {
  dirname, resolve, isAbsolute
} from 'path';
import { existsSync, statSync } from 'fs';
import {
  scanFiles,
  getJsFilesRecursive,
  getGitDiffFiles,
  getAllTestCaseIds,
  filterIgnoredFiles
} from './test-case-scanner.js';
import {
  validateTestCases,
  printValidationSummary
} from './test-case-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get workspace root (5 levels up from utils/pipeline-utils/test-case-check)
const WORKSPACE_ROOT = resolve(__dirname, '../../../../../');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  const config = {
    mode: null,
    paths: [],
    branch1: null,
    branch2: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--all') {
      config.mode = 'all';
    } else if (arg === '--count-only') {
      config.mode = 'count-only';
    } else if (arg === '--files') {
      config.mode = 'files';
      // Collect all paths until next flag or end
      i++;
      while (i < args.length && !args[i].startsWith('--')) {
        config.paths.push(args[i]);
        i++;
      }
      i--; // Step back one since loop will increment
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
    throw new Error('No mode specified. Use --all, --files, or --git-diff');
  }

  return config;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Test Case Health Check - Validate Zephyr test case IDs

Usage:
  npm run health-check -- [options]

Options:
  --all                           Scan all .js files in the workspace
  --files <path1> <path2> ...     Scan specific files or directories
  --git-diff <branch> [branch2]   Scan files changed between branches
  -h, --help                      Show this help message

Examples:
  # Scan all files
  npm run health-check -- --all

  # Scan specific files
  npm run health-check -- --files packages/api-tests/tests/login.spec.js

  # Scan specific directory
  npm run health-check -- --files packages/api-tests/tests

  # Compare main branch with current HEAD
  npm run health-check -- --git-diff main

  # Compare main and feature branch
  npm run health-check -- --git-diff main feature/new-tests

  # Compare origin/main and current branch
  npm run health-check -- --git-diff origin/main HEAD
`);
}

/**
 * Get files to scan based on mode
 * @param {Object} config - Configuration object
 * @returns {string[]} Array of file paths
 */
function getFilesToScan(config) {
  const files = [];

  if (config.mode === 'all' || config.mode === 'count-only') {
    console.log('Scanning all .js files in workspace...');
    const allFiles = filterIgnoredFiles(getJsFilesRecursive(WORKSPACE_ROOT));
    return allFiles;
  }

  if (config.mode === 'files') {
    console.log('Scanning specified files/directories...');

    for (const path of config.paths) {
      const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path);

      if (!existsSync(absolutePath)) {
        console.warn(`Warning: Path does not exist: ${absolutePath}`);
        continue;
      }

      const stat = statSync(absolutePath);

      if (stat.isDirectory()) {
        const dirFiles = getJsFilesRecursive(absolutePath);
        files.push(...dirFiles);
      } else if (stat.isFile() && absolutePath.endsWith('.js')) {
        files.push(absolutePath);
      }
    }

    return files;
  }

  if (config.mode === 'git-diff') {
    console.log(`Getting files changed between ${config.branch1} and ${config.branch2}...`);
    return getGitDiffFiles(config.branch1, config.branch2, WORKSPACE_ROOT);
  }

  return files;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('TEST CASE HEALTH CHECK');
    console.log('='.repeat(80));

    // Parse arguments
    const config = parseArgs();

    // Get files to scan
    const filesToScan = getFilesToScan(config);

    if (filesToScan.length === 0) {
      console.log('\n⚠️  No .js files found to scan.');
      process.exit(0);
    }

    console.log(`\nFound ${filesToScan.length} .js file(s) to scan.\n`);

    // Scan files for test case IDs
    console.log('Scanning files for test case IDs...');
    const scanResults = scanFiles(filesToScan);

    if (scanResults.length === 0) {
      console.log('\n✓ No test case IDs found in scanned files.');
      process.exit(0);
    }

    console.log(`Found test case IDs in ${scanResults.length} file(s).`);

    // Get all unique test case IDs
    const allTestCaseIds = getAllTestCaseIds(scanResults);
    const uniqueIds = Array.from(allTestCaseIds).sort();

    console.log(`Total unique test case IDs: ${uniqueIds.length}`);

    // Count-only mode: show per-package breakdown and exit
    if (config.mode === 'count-only') {
      const pkgCounts = {};
      for (const result of scanResults) {
        const pkg = result.filePath.includes('/api-automation/') ? 'API'
          : result.filePath.includes('/web-automation/') ? 'Web'
            : result.filePath.includes('/mobile-automation/') ? 'Mobile'
              : 'Other';
        pkgCounts[pkg] = (pkgCounts[pkg] || 0) + result.testCaseIds.length;
      }
      console.log('\nTest case IDs per module:');
      for (const [pkg, count] of Object.entries(pkgCounts).sort()) {
        console.log(`  ${pkg}: ${count}`);
      }
      console.log('\nRun without --count-only to validate against Zephyr.');
      process.exit(0);
    }

    // Validate test cases against Zephyr
    const validationResults = await validateTestCases(uniqueIds);

    // Print summary
    printValidationSummary(validationResults, scanResults);

    // Exit with error if invalid test cases found
    if (validationResults.invalid.length > 0) {
      console.log(`\n❌ Health check FAILED: ${validationResults.invalid.length} invalid test case(s) found.`);
      process.exit(1);
    } else {
      console.log('\n✅ Health check PASSED: All test cases are valid.');
      process.exit(0);
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

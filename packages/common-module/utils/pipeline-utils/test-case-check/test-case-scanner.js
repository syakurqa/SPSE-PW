/* eslint-disable no-console */
import {
  readFileSync, readdirSync, statSync, existsSync
} from 'fs';
import {
  join, extname, resolve, dirname
} from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pattern to match test case IDs: @KEY-TNUMBER
 * Captures: KEY and NUMBER
 */
const TEST_CASE_ID_PATTERN = /@([A-Z0-9]+)-T(\d+)/g;

/**
 * Read ignore patterns from .testcaseignore file
 * @returns {string[]} Array of ignore patterns
 */
function readIgnorePatterns() {
  const ignoreFilePath = resolve(__dirname, '../../../../../.testcaseignore');

  if (!existsSync(ignoreFilePath)) {
    return [];
  }

  try {
    const content = readFileSync(ignoreFilePath, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments
  } catch (error) {
    console.warn(`Warning: Could not read .testcaseignore file: ${error.message}`);
    return [];
  }
}

/**
 * Check if a file should be ignored based on ignore patterns
 * @param {string} filePath - File path to check
 * @param {string[]} ignorePatterns - Array of ignore patterns
 * @returns {boolean} True if file should be ignored
 */
function shouldIgnoreFile(filePath, ignorePatterns) {
  // Simple string matching - if file path contains any pattern, ignore it
  return ignorePatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Filter out ignored files from file list
 * @param {string[]} files - Array of file paths
 * @returns {string[]} Filtered array of file paths
 */
export function filterIgnoredFiles(files) {
  const ignorePatterns = readIgnorePatterns();

  if (ignorePatterns.length === 0) {
    return files;
  }

  const filtered = files.filter(file => !shouldIgnoreFile(file, ignorePatterns));
  const ignoredCount = files.length - filtered.length;

  if (ignoredCount > 0) {
    console.log(`Ignored ${ignoredCount} file(s) based on .testcaseignore patterns`);
  }

  return filtered;
}

/**
 * Extract test case IDs from file content
 * @param {string} content - File content
 * @returns {string[]} Array of unique test case IDs (e.g., ['PBF2-T1234', 'CORE-T456'])
 */
export function extractTestCaseIds(content) {
  const testCaseIds = new Set();
  let match;

  // Reset regex state
  TEST_CASE_ID_PATTERN.lastIndex = 0;

  while ((match = TEST_CASE_ID_PATTERN.exec(content)) !== null) {
    const key = match[1];
    const number = match[2];
    testCaseIds.add(`${key}-T${number}`);
  }

  return Array.from(testCaseIds);
}

/**
 * Extract ALL test case ID occurrences from file content (including duplicates)
 * @param {string} content - File content
 * @returns {string[]} Array of all test case IDs including duplicates
 */
export function extractAllTestCaseIds(content) {
  const testCaseIds = [];
  let match;

  // Reset regex state
  TEST_CASE_ID_PATTERN.lastIndex = 0;

  while ((match = TEST_CASE_ID_PATTERN.exec(content)) !== null) {
    const key = match[1];
    const number = match[2];
    testCaseIds.push(`${key}-T${number}`);
  }

  return testCaseIds;
}

/**
 * Scan a single file for test case IDs
 * @param {string} filePath - Absolute path to file
 * @returns {Object} Object with filePath, testCaseIds (unique), and allTestCaseIds (with duplicates)
 */
export function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const testCaseIds = extractTestCaseIds(content);
    const allTestCaseIds = extractAllTestCaseIds(content);

    return {
      filePath,
      testCaseIds,
      allTestCaseIds
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return {
      filePath,
      testCaseIds: [],
      error: error.message
    };
  }
}

/**
 * Recursively scan directory for .js files
 * @param {string} dir - Directory path
 * @param {string[]} fileList - Accumulated file list
 * @returns {string[]} Array of .js file paths
 */
export function getJsFilesRecursive(dir, fileList = []) {
  try {
    const files = readdirSync(dir);

    files.forEach(file => {
      const filePath = join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (file !== 'node_modules' && !file.startsWith('.')) {
          getJsFilesRecursive(filePath, fileList);
        }
      } else if (stat.isFile() && extname(file) === '.js') {
        fileList.push(filePath);
      }
    });

    // Apply ignore patterns only on the initial call (not during recursion)
    return fileList;
  } catch (error) {
    console.error(`Error scanning directory ${dir}: ${error.message}`);
    return fileList;
  }
}

/**
 * Get files changed between two git branches
 * @param {string} branch1 - First branch (e.g., 'main')
 * @param {string} branch2 - Second branch (e.g., 'feature/my-feature')
 * @param {string} workspaceRoot - Workspace root directory
 * @returns {string[]} Array of changed .js file paths
 */
export function getGitDiffFiles(branch1, branch2, workspaceRoot) {
  try {
    // Get list of changed files between branches
    const command = branch2 ? `git diff --name-only ${branch1}...${branch2}` : `git diff --name-only ${branch1}`;
    const output = execSync(command, {
      cwd: workspaceRoot,
      encoding: 'utf8'
    });

    const files = output
      .split('\n')
      .filter(file => file.trim() && file.endsWith('.js'))
      .map(file => join(workspaceRoot, file));

    // Apply ignore patterns
    return filterIgnoredFiles(files);
  } catch (error) {
    console.error(`Error getting git diff: ${error.message}`);
    return [];
  }
}

/**
 * Scan multiple files for test case IDs
 * @param {string[]} filePaths - Array of file paths to scan
 * @returns {Object[]} Array of scan results
 */
export function scanFiles(filePaths) {
  const results = [];

  for (const filePath of filePaths) {
    const result = scanFile(filePath);
    if (result.testCaseIds.length > 0) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Get all unique test case IDs from scan results
 * @param {Object[]} scanResults - Array of scan results
 * @returns {Set<string>} Set of unique test case IDs
 */
export function getAllTestCaseIds(scanResults) {
  const allIds = new Set();

  for (const result of scanResults) {
    for (const id of result.testCaseIds) {
      allIds.add(id);
    }
  }

  return allIds;
}

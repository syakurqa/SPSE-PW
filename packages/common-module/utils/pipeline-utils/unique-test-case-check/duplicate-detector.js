/* eslint-disable no-console */

/**
 * Build a map of test case IDs to their file locations
 * @param {Object[]} scanResults - Array of scan results from scanner
 * @returns {Map<string, string[]>} Map of test case ID to array of file paths
 */
export function buildTestCaseMap(scanResults) {
  const testCaseMap = new Map();

  for (const result of scanResults) {
    // Use allTestCaseIds to capture duplicates within the same file
    const idsToProcess = result.allTestCaseIds || result.testCaseIds;
    for (const testCaseId of idsToProcess) {
      if (!testCaseMap.has(testCaseId)) {
        testCaseMap.set(testCaseId, []);
      }
      testCaseMap.get(testCaseId).push(result.filePath);
    }
  }

  return testCaseMap;
}

/**
 * Find duplicate test case IDs (appearing in multiple locations)
 * @param {Map<string, string[]>} testCaseMap - Map of test case ID to file paths
 * @returns {Object} Object with duplicates and unique arrays
 */
export function findDuplicates(testCaseMap) {
  const duplicates = [];
  const unique = [];

  for (const [testCaseId, filePaths] of testCaseMap.entries()) {
    // Remove duplicate file paths (in case same ID appears multiple times in same file)
    const uniqueFilePaths = [...new Set(filePaths)];

    if (uniqueFilePaths.length > 1 || filePaths.length > 1) {
      // Either appears in multiple files OR multiple times (even in same file)
      duplicates.push({
        testCaseId,
        occurrences: filePaths.length,
        files: uniqueFilePaths,
        locations: filePaths // Keep all occurrences including duplicates in same file
      });
    } else {
      unique.push({
        testCaseId,
        file: filePaths[0]
      });
    }
  }

  return {
    duplicates: duplicates.sort((a, b) => b.occurrences - a.occurrences), // Sort by occurrence count
    unique
  };
}

/**
 * Check for duplicates introduced by new/changed files against all existing files
 * @param {Object[]} changedFilesResults - Scan results from changed files
 * @param {Object[]} allFilesResults - Scan results from all files in project
 * @returns {Object} Object with newDuplicates and summary
 */
export function checkNewDuplicates(changedFilesResults, allFilesResults) {
  // Build map of test case IDs from changed files
  const changedTestCases = new Map();
  for (const result of changedFilesResults) {
    // Use allTestCaseIds to capture duplicates within the same file
    const idsToProcess = result.allTestCaseIds || result.testCaseIds;
    for (const testCaseId of idsToProcess) {
      if (!changedTestCases.has(testCaseId)) {
        changedTestCases.set(testCaseId, []);
      }
      changedTestCases.get(testCaseId).push(result.filePath);
    }
  }

  // Build map of test case IDs from ALL files
  const allTestCases = buildTestCaseMap(allFilesResults);

  // Find which test case IDs from changed files are duplicates in the entire project
  const newDuplicates = [];
  const changedFilesPaths = new Set(changedFilesResults.map(r => r.filePath));

  for (const testCaseId of changedTestCases.keys()) {
    const allOccurrences = allTestCases.get(testCaseId) || [];
    const uniqueAllFiles = [...new Set(allOccurrences)];

    // Check if this test case ID appears in multiple places when considering all files
    if (uniqueAllFiles.length > 1 || allOccurrences.length > 1) {
      // Separate files into changed vs existing
      const existingFiles = uniqueAllFiles.filter(f => !changedFilesPaths.has(f));
      const affectedChangedFiles = uniqueAllFiles.filter(f => changedFilesPaths.has(f));

      newDuplicates.push({
        testCaseId,
        totalOccurrences: allOccurrences.length,
        changedFiles: affectedChangedFiles,
        existingFiles: existingFiles,
        allFiles: uniqueAllFiles
      });
    }
  }

  return {
    newDuplicates: newDuplicates.sort((a, b) => b.totalOccurrences - a.totalOccurrences),
    changedFilesCount: changedFilesResults.length,
    changedTestCasesCount: changedTestCases.size
  };
}

/**
 * Print duplicate detection summary
 * @param {Object} results - Results from findDuplicates
 * @param {number} totalFiles - Total number of files scanned
 */
export function printDuplicateSummary(results, totalFiles) {
  console.log('\n' + '='.repeat(80));
  console.log('DUPLICATE TEST CASE CHECK - SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nTotal Files Scanned: ${totalFiles}`);
  console.log(`Total Unique Test Case IDs: ${results.unique.length + results.duplicates.length}`);
  console.log(`✓ Unique Test Cases: ${results.unique.length}`);
  console.log(`✗ Duplicate Test Cases: ${results.duplicates.length}`);

  if (results.duplicates.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('DUPLICATE TEST CASES FOUND:');
    console.log('-'.repeat(80));

    for (const duplicate of results.duplicates) {
      console.log(`\n✗ ${duplicate.testCaseId}`);
      console.log(`  Total Occurrences: ${duplicate.occurrences}`);
      console.log(`  Found in ${duplicate.files.length} file(s):`);

      for (const filePath of duplicate.files) {
        // Count how many times this ID appears in this specific file
        const countInFile = duplicate.locations.filter(f => f === filePath).length;
        if (countInFile > 1) {
          console.log(`    - ${filePath} (${countInFile} times)`);
        } else {
          console.log(`    - ${filePath}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Print git diff duplicate check summary
 * @param {Object} results - Results from checkNewDuplicates
 */
export function printGitDiffDuplicateSummary(results) {
  console.log('\n' + '='.repeat(80));
  console.log('GIT DIFF DUPLICATE CHECK - SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nChanged Files: ${results.changedFilesCount}`);
  console.log(`Test Case IDs in Changed Files: ${results.changedTestCasesCount}`);
  console.log(`✗ Duplicate Test Cases Detected: ${results.newDuplicates.length}`);

  if (results.newDuplicates.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('DUPLICATES INTRODUCED OR AFFECTED BY CHANGES:');
    console.log('-'.repeat(80));

    for (const duplicate of results.newDuplicates) {
      console.log(`\n✗ ${duplicate.testCaseId}`);
      console.log(`  Total Occurrences: ${duplicate.totalOccurrences}`);

      if (duplicate.changedFiles.length > 0) {
        console.log(`  In Changed Files (${duplicate.changedFiles.length}):`);
        for (const filePath of duplicate.changedFiles) {
          console.log(`    - ${filePath}`);
        }
      }

      if (duplicate.existingFiles.length > 0) {
        console.log(`  In Existing Files (${duplicate.existingFiles.length}):`);
        for (const filePath of duplicate.existingFiles) {
          console.log(`    - ${filePath}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
}

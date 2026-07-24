import { getTestCyclesByFolder, getTestCase } from './zephyr-api.js';

/**
 * Extract test case key from a test execution's testCase.self URL.
 * e.g. ".../testcases/PBF2-T3525/versions/1" → "PBF2-T3525"
 */
export function extractTestCaseKey(execution) {
  if (!execution?.testCase?.self) return null;
  const match = execution.testCase.self.match(/testcases\/([A-Z0-9]+-T\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch test case statuses for a batch of test case keys.
 * Returns a Map of testCaseKey → statusId.
 */
export async function getTestCaseStatusMap(testCaseKeys) {
  const BATCH_SIZE = 20;
  const statusMap = new Map();

  for (let i = 0; i < testCaseKeys.length; i += BATCH_SIZE) {
    const batch = testCaseKeys.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (key) => {
        try {
          const tc = await getTestCase(key);
          return {
            key,
            statusId: tc.status?.id
          };
        } catch {
          return {
            key,
            statusId: null
          };
        }
      })
    );
    for (const { key, statusId } of results) {
      statusMap.set(key, statusId);
    }
  }

  return statusMap;
}

export function findRegressionSuiteFolder(folders) {
  return folders.find(f =>
    f.name && f.name.toLowerCase().includes('regression suite')
  );
}

export function findPlatformFolders(folders, parentId) {
  return folders.filter(f => f.parentId === parentId);
}

/**
 * Get direct child folders under a parent folder.
 * These represent "features" — one level below the platform folder.
 */
export function getDirectChildFolders(folders, parentId) {
  const pid = Number(parentId);
  return folders.filter(f => Number(f.parentId) === pid);
}

/**
 * Recursively collect all descendant folder IDs under a parent folder (including the parent itself).
 */
export function getAllDescendantFolderIds(folders, parentId) {
  const pid = Number(parentId);
  const result = [pid];
  const children = folders.filter(f => Number(f.parentId) === pid);
  for (const child of children) {
    result.push(...getAllDescendantFolderIds(folders, child.id));
  }
  return result;
}

/**
 * Get all descendant folders with their path relative to a parent folder.
 * Returns array of { id, name, path, parentId } where path is like "MOU/Lead".
 */
export function getAllDescendantFoldersWithPath(folders, parentId, parentPath = '') {
  const pid = Number(parentId);
  const children = folders.filter(f => Number(f.parentId) === pid);
  const result = [];
  for (const child of children) {
    const path = parentPath ? `${parentPath}/${child.name.trim()}` : child.name.trim();
    result.push({
      id: child.id,
      name: child.name,
      path,
      parentId: child.parentId
    });
    result.push(...getAllDescendantFoldersWithPath(folders, child.id, path));
  }
  return result;
}

/**
 * Fetch test cycles from a folder and all its descendant sub-folders.
 */
export async function getTestCyclesRecursive(allFolders, parentFolderId) {
  const folderIds = getAllDescendantFolderIds(allFolders, parentFolderId);
  const allCycles = [];
  for (const folderId of folderIds) {
    const cycles = await getTestCyclesByFolder(folderId);
    allCycles.push(...cycles);
  }
  return allCycles;
}

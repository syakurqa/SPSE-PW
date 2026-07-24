import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Regex to match Zephyr test case IDs in spec files (e.g., @PBF2-T123)
 */
export const TC_ID_REGEX = /@([A-Z][A-Z0-9]*-T\d+)/g;

/**
 * Scan all spec files in the repo and extract test case IDs.
 *
 * When returnByFile is false (default):
 *   Returns a Map<testCaseKey, Set<filePath>>
 *
 * When returnByFile is true:
 *   Returns a Map<projectKey, Map<filePath, Set<tcKey>>>
 */
export function scanRepoTestCases(repoRoot, { projectFilter = null, returnByFile = false } = {}) {
  const specFiles = execSync(
    'find packages -name "*.spec.js" -not -path "*/node_modules/*"',
    {
      cwd: repoRoot,
      encoding: 'utf-8'
    }
  ).trim().split('\n').filter(Boolean);

  if (returnByFile) {
    return scanByFile(specFiles, repoRoot, projectFilter);
  }
  return scanByTestCase(specFiles, repoRoot, projectFilter);
}

function scanByTestCase(specFiles, repoRoot, projectFilter) {
  const tcMap = new Map();

  for (const relPath of specFiles) {
    const fullPath = path.join(repoRoot, relPath);
    let content;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    for (const match of content.matchAll(TC_ID_REGEX)) {
      const tcKey = match[1];
      const projectKey = tcKey.replace(/-T\d+$/, '');
      if (projectFilter && projectKey !== projectFilter) continue;

      if (!tcMap.has(tcKey)) tcMap.set(tcKey, new Set());
      tcMap.get(tcKey).add(relPath);
    }
  }

  return tcMap;
}

function scanByFile(specFiles, repoRoot, projectFilter) {
  const tcMap = new Map();

  for (const relPath of specFiles) {
    const fullPath = path.join(repoRoot, relPath);
    let content;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    for (const match of content.matchAll(TC_ID_REGEX)) {
      const tcKey = match[1];
      const projectKey = tcKey.replace(/-T\d+$/, '');
      if (projectFilter && projectKey !== projectFilter) continue;

      if (!tcMap.has(projectKey)) tcMap.set(projectKey, new Map());
      const projectMap = tcMap.get(projectKey);
      if (!projectMap.has(relPath)) projectMap.set(relPath, new Set());
      projectMap.get(relPath).add(tcKey);
    }
  }

  return tcMap;
}

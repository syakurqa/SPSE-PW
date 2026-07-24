import {
  getFolders,
  getTestExecutions,
} from './zephyr-api.js';
import {
  getTestCyclesRecursive,
  extractTestCaseKey,
} from './zephyr-utils.js';

/**
 * Get all test case keys currently in regression test cycles for a project.
 *
 * Queries the DB for active platforms with zephyr_test_cycle_folder_id set,
 * then fetches all test executions from those cycles.
 *
 * Returns { cycleKeys: Set<string>, allFolders: Array, platforms: Array }
 */
export async function getCycleTestCaseKeys(project, db) {
  const platforms = await db('platforms')
    .join('squad_platform_ownership', 'platforms.id', 'squad_platform_ownership.platform_id')
    .join('squads', 'squads.id', 'squad_platform_ownership.squad_id')
    .where('squads.zephyr_key', project.key)
    .whereNull('squad_platform_ownership.effective_to')
    .whereNotNull('platforms.zephyr_test_cycle_folder_id')
    .where({ 'platforms.is_active': true })
    .select('platforms.*');

  const allFolders = await getFolders(project.key);
  const cycleKeys = new Set();

  for (const platform of platforms) {
    const testCycles = await getTestCyclesRecursive(allFolders, platform.zephyr_test_cycle_folder_id);
    for (const cycle of testCycles) {
      const executions = await getTestExecutions(cycle.key);
      for (const exec of executions) {
        const key = extractTestCaseKey(exec);
        if (key) cycleKeys.add(key);
      }
    }
  }

  return {
    cycleKeys,
    allFolders,
    platforms
  };
}

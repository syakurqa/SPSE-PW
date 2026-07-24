/* eslint-disable no-console */
/**
 * Uncategorized Test Cases Report
 *
 * Scans automation repo spec files for test case IDs, then checks which ones
 * are NOT present in any Zephyr regression test cycle. Outputs a report of
 * uncategorized test cases grouped by project key and file.
 *
 * Usage:
 *   npm run tc:uncategorized --workspace=@automation/reporting-module
 *   npm run tc:uncategorized --workspace=@automation/reporting-module -- --project=PBF2
 */

import { execSync } from 'child_process';
import { getConnection, destroyConnection } from '../lib/database.js';
import { scanRepoTestCases } from '../lib/repo-scanner.js';
import { getCycleTestCaseKeys } from '../lib/cycle-resolver.js';

async function main() {
  const args = process.argv.slice(2);
  const projectFlag = args.find(a => a.startsWith('--project='));
  const projectFilter = projectFlag ? projectFlag.split('=')[1] : null;
  const skipZephyr = args.includes('--local-only');

  // Find repo root (go up from package dir to monorepo root)
  const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

  console.log('\n===== Uncategorized Test Cases Report =====\n');

  // Step 1: Scan repo
  console.log('📂 Scanning repo for test case IDs...');
  const repoTCs = scanRepoTestCases(repoRoot, { projectFilter });
  console.log(`   Found ${repoTCs.size} unique test case IDs in repo`);

  // Group by project key
  const byProject = new Map();
  for (const [tcKey, files] of repoTCs) {
    const projectKey = tcKey.replace(/-T\d+$/, '');
    if (!byProject.has(projectKey)) {
      byProject.set(projectKey, new Map());
    }
    byProject.get(projectKey).set(tcKey, files);
  }

  if (skipZephyr) {
    console.log('\n⏭️  --local-only mode: skipping Zephyr cycle check\n');
    for (const [projectKey, tcs] of [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`\n📋 ${projectKey}: ${tcs.size} test cases in repo`);
    }
    console.log('\n===== Report Complete =====\n');
    return;
  }

  // Step 2: Fetch cycle test cases from Zephyr
  const db = getConnection();

  // Load squads with configured platforms from DB
  const allSquads = await db('squads').where({ is_active: true });
  const platformsBySquad = await db('platforms')
    .join('squad_platform_ownership', 'platforms.id', 'squad_platform_ownership.platform_id')
    .join('squads', 'squads.id', 'squad_platform_ownership.squad_id')
    .whereNull('squad_platform_ownership.effective_to')
    .whereNotNull('platforms.zephyr_test_cycle_folder_id')
    .where({ 'platforms.is_active': true })
    .select('squads.zephyr_key');

  const configuredKeys = new Set(platformsBySquad.map(p => p.zephyr_key));
  const squadsWithPlatforms = allSquads.filter(s => configuredKeys.has(s.zephyr_key));

  const projectsToCheck = projectFilter
    ? squadsWithPlatforms.filter(s => s.zephyr_key === projectFilter)
    : squadsWithPlatforms;

  if (projectsToCheck.length === 0) {
    console.log(`\n⚠️  No matching projects found${projectFilter ? ` for key "${projectFilter}"` : ''}`);
    destroyConnection();
    return;
  }

  let totalUncategorized = 0;
  let totalCategorized = 0;
  const checkedKeys = new Set();

  for (const squad of projectsToCheck) {
    const projectTCs = byProject.get(squad.zephyr_key);
    checkedKeys.add(squad.zephyr_key);
    if (!projectTCs || projectTCs.size === 0) {
      console.log(`\n⏭️  ${squad.squad_name} (${squad.zephyr_key}): No test cases found in repo`);
      continue;
    }

    console.log(`\n🔍 ${squad.squad_name} (${squad.zephyr_key}): Checking ${projectTCs.size} test cases...`);

    const project = { key: squad.zephyr_key };
    const { cycleKeys } = await getCycleTestCaseKeys(project, db);
    console.log(`   ${cycleKeys.size} test cases found in regression cycles`);

    // Find uncategorized (in repo but NOT in any cycle)
    const uncategorized = new Map();
    for (const [tcKey, files] of projectTCs) {
      if (!cycleKeys.has(tcKey)) {
        uncategorized.set(tcKey, files);
      }
    }

    totalCategorized += projectTCs.size - uncategorized.size;

    if (uncategorized.size === 0) {
      console.log('   ✅ All test cases are in regression cycles!');
      continue;
    }

    totalUncategorized += uncategorized.size;
    console.log(`   ⚠️  ${uncategorized.size} uncategorized test cases:\n`);

    // Group uncategorized by file
    const byFile = new Map();
    for (const [tcKey, files] of uncategorized) {
      for (const file of files) {
        if (!byFile.has(file)) {
          byFile.set(file, []);
        }
        byFile.get(file).push(tcKey);
      }
    }

    for (const [file, tcKeys] of [...byFile.entries()].sort()) {
      console.log(`      📄 ${file}`);
      for (const key of tcKeys.sort()) {
        console.log(`         - ${key}`);
      }
    }
  }

  // Report squads that have TCs in repo but no platform cycle folder configured
  const allSquadKeys = new Set(allSquads.map(s => s.zephyr_key));
  const notConfigured = [...byProject.entries()]
    .filter(([key]) => allSquadKeys.has(key) && !checkedKeys.has(key))
    .sort((a, b) => b[1].size - a[1].size);

  let totalNotConfigured = 0;
  if (notConfigured.length > 0) {
    console.log('\n⚠️  Squads without platform cycle folder configured (skipped):');
    for (const [key, tcs] of notConfigured) {
      const squad = allSquads.find(s => s.zephyr_key === key);
      const name = squad ? squad.squad_name : key;
      console.log(`   - ${name} (${key}): ${tcs.size} TCs`);
      totalNotConfigured += tcs.size;
    }
    console.log('   → Run "npm run setup" to configure platform cycle folders for these squads');
  }

  // Report TCs from projects NOT in DB at all
  const unconfiguredProjects = [...byProject.keys()].filter(k => !allSquadKeys.has(k)).sort();
  let totalUnknown = 0;
  if (unconfiguredProjects.length > 0) {
    console.log('\n⚠️  Test cases from unknown projects (not in database):');
    for (const key of unconfiguredProjects) {
      const count = byProject.get(key).size;
      console.log(`   - ${key}: ${count} TCs`);
      totalUnknown += count;
    }
  }

  console.log('\n===== Summary =====');
  console.log(`   Total test cases in repo: ${repoTCs.size}`);
  console.log(`   ✅ Categorized (in cycles): ${totalCategorized}`);
  console.log(`   ⚠️  Uncategorized (no cycle): ${totalUncategorized}`);
  if (totalNotConfigured > 0) {
    console.log(`   🔧 Not configured (no platform setup): ${totalNotConfigured}`);
  }
  if (totalUnknown > 0) {
    console.log(`   ❓ Unknown projects: ${totalUnknown}`);
  }
  console.log('===== Report Complete =====\n');

  destroyConnection();
}

main().catch(err => {
  console.error('Report failed:', err);
  process.exit(1);
});

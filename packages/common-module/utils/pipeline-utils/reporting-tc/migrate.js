/* eslint-disable no-console */
/**
 * Bulk Test Case Migration Script
 *
 * Interactive flow:
 *   1. Scan repo for uncategorized test cases
 *   2. User multi-selects spec files to migrate
 *   3. User picks one platform/service as the target
 *   4. User picks folder placement (root / existing / create new)
 *   5. Show migration plan (dry-run) or execute
 *
 * Cycle naming:
 *   Full path after tests/ converted to Title Case, joined by " - "
 *   e.g. tests/survey/address.spec.js → "Survey - Address"
 *
 * Usage:
 *   npm run tc:migrate -- --project=DMTM
 *   npm run tc:migrate -- --project=DMTM --execute
 */

import { execSync } from 'child_process';
import {
  select, checkbox, input, Separator
} from '@inquirer/prompts';
import {
  createTestCycle,
  createTestExecution,
  createFolder,
} from '../lib/zephyr-api.js';
import { getTestCyclesRecursive, getAllDescendantFoldersWithPath } from '../lib/zephyr-utils.js';
import { getConnection, destroyConnection } from '../lib/database.js';
import { scanRepoTestCases } from '../lib/repo-scanner.js';
import { getCycleTestCaseKeys } from '../lib/cycle-resolver.js';

const API_DELAY_MS = 200;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toTitleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Derive cycle name from a spec file path.
 * Returns { workspace, cycleName } or null if unmappable.
 */
function parseSpecFilePath(relPath) {
  const parts = relPath.split('/');
  if (parts[0] !== 'packages' || parts.length < 4) return null;

  const workspace = parts[1];

  if (workspace === 'web-automation' || workspace === 'mobile-automation') {
    const testsIdx = parts.indexOf('tests');
    if (testsIdx === -1) {
      const afterPlatform = parts.slice(3);
      const specFile = afterPlatform.pop().replace(/\.spec\.js$/, '');
      const segments = [...afterPlatform, specFile].filter(Boolean);
      return {
        workspace,
        cycleName: segments.map(toTitleCase).join(' - ') || toTitleCase(specFile),
      };
    }

    const afterTests = parts.slice(testsIdx + 1);
    const specFile = afterTests.pop().replace(/\.spec\.js$/, '');
    const segments = [...afterTests, specFile].filter(Boolean);
    return {
      workspace,
      cycleName: segments.map(toTitleCase).join(' - '),
    };
  }

  if (workspace === 'api-automation') {
    if (parts[2] !== 'tests' || parts.length < 5) return null;
    const afterService = parts.slice(4);
    const specFile = afterService.pop().replace(/\.spec\.js$/, '');
    const segments = [...afterService, specFile].filter(Boolean);
    return {
      workspace,
      cycleName: segments.map(toTitleCase).join(' - '),
    };
  }

  return null;
}

/**
 * Find an existing cycle by name within the platform's folder tree.
 */
function findExistingCycle(cycleName, existingCycles) {
  return existingCycles.find(
    c => c.name && c.name.toLowerCase().trim() === cycleName.toLowerCase().trim()
  );
}

/**
 * Shorten a spec file path for display.
 * e.g. packages/api-automation/tests/backoffice/ssf/lead.spec.js → api/backoffice/ssf/lead.spec.js
 */
function shortenPath(filePath) {
  return filePath
    .replace(/^packages\//, '')
    .replace('-automation/', '/');
}

async function main() {
  const args = process.argv.filter(a => a !== '--').slice(2);
  const projectFlag = args.find(a => a.startsWith('--project='));
  const projectFilter = projectFlag ? projectFlag.split('=')[1] : null;
  const executeMode = args.includes('--execute');

  if (!projectFilter) {
    console.log('❌ --project flag is required. Example: npm run tc:migrate -- --project=DMTM');
    process.exit(1);
  }

  const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

  console.log('\n===== Test Case Bulk Migration =====');
  console.log(`Mode: ${executeMode ? '🔴 EXECUTE (changes will be made)' : '🟢 DRY-RUN (no changes)'}\n`);

  // Step 1: Scan repo
  console.log('📂 Scanning repo for test case IDs...');
  const repoTCsByProject = scanRepoTestCases(repoRoot, {
    projectFilter,
    returnByFile: true
  });

  const db = getConnection();

  try {
    // Load squad and platforms
    const squad = await db('squads')
      .where({
        zephyr_key: projectFilter,
        is_active: true
      })
      .first();

    if (!squad) {
      console.log(`❌ Project "${projectFilter}" not found in database.`);
      return;
    }

    const projectPlatforms = await db('platforms')
      .join('squad_platform_ownership', 'platforms.id', 'squad_platform_ownership.platform_id')
      .whereNull('squad_platform_ownership.effective_to')
      .where({
        'platforms.is_active': true,
        'squad_platform_ownership.squad_id': squad.id
      })
      .select('platforms.*');

    const platformsWithFolder = projectPlatforms.filter(p => p.zephyr_test_cycle_folder_id);

    if (platformsWithFolder.length === 0) {
      console.log(`❌ No platforms with folder IDs configured for "${projectFilter}".`);
      console.log('   Run \'npm run setup\' to configure platforms first.');
      return;
    }

    const projectFiles = repoTCsByProject.get(projectFilter);
    if (!projectFiles || projectFiles.size === 0) {
      console.log(`ℹ️  No spec files found for project "${projectFilter}".`);
      return;
    }

    console.log(`\n━━━ ${squad.squad_name} (${squad.zephyr_key}) ━━━`);

    // Get existing regression cycle TCs
    const project = { key: squad.zephyr_key };
    const { cycleKeys, allFolders } = await getCycleTestCaseKeys(project, db);
    console.log(`   ${cycleKeys.size} TCs already in regression cycles`);

    // Build list of spec files with uncategorized TCs
    const uncategorizedFiles = [];
    for (const [filePath, tcKeys] of projectFiles) {
      const uncategorized = [...tcKeys].filter(k => !cycleKeys.has(k));
      if (uncategorized.length === 0) continue;
      uncategorizedFiles.push({
        filePath,
        tcKeys: uncategorized
      });
    }

    if (uncategorizedFiles.length === 0) {
      console.log('   ✅ All test cases are already in regression cycles!');
      return;
    }

    console.log(`   ${uncategorizedFiles.length} spec files with uncategorized TCs\n`);

    // Step 2: Multi-select spec files
    const selectedFiles = await checkbox({
      message: `Select spec files to migrate (${uncategorizedFiles.length} available):`,
      choices: uncategorizedFiles
        .sort((a, b) => a.filePath.localeCompare(b.filePath))
        .map(f => ({
          name: `${shortenPath(f.filePath)} (${f.tcKeys.length} TCs)`,
          value: f.filePath,
        })),
      pageSize: 20,
    });

    if (selectedFiles.length === 0) {
      console.log('\n⚠️  No files selected. Exiting.');
      return;
    }

    const selectedEntries = uncategorizedFiles.filter(f => selectedFiles.includes(f.filePath));
    const totalSelectedTCs = selectedEntries.reduce((sum, f) => sum + f.tcKeys.length, 0);
    console.log(`\n   Selected: ${selectedFiles.length} files, ${totalSelectedTCs} TCs`);

    // Step 3 + 3.5: Pick target platform & folder (with back navigation)
    let platform;
    let targetFolderId;
    let pendingFolderName;

    pickPlatform: while (true) {
      const platformId = await select({
        message: 'Select target platform/service:',
        choices: [
          new Separator('  ── Platforms ──'),
          ...platformsWithFolder
            .filter(p => p.platform_type === 'PLATFORM')
            .map(p => ({
              name: `${p.platform_name} (PLATFORM)`,
              value: p.id,
            })),
          new Separator('  ── Services ──'),
          ...platformsWithFolder
            .filter(p => p.platform_type === 'SERVICE')
            .map(p => ({
              name: `${p.platform_name} (SERVICE)`,
              value: p.id,
            })),
        ],
      });

      platform = platformsWithFolder.find(p => p.id === platformId);
      console.log(`\n   Target: ${platform.platform_name} (folder: ${platform.zephyr_test_cycle_folder_id})`);

      // Step 3.5: Choose target folder placement
      const descendants = getAllDescendantFoldersWithPath(allFolders, platform.zephyr_test_cycle_folder_id);

      const firstSegments = selectedEntries
        .map(e => {
          const parsed = parseSpecFilePath(e.filePath);
          return parsed ? parsed.cycleName.split(' - ')[0] : null;
        })
        .filter(Boolean);
      const suggestedFolderName = firstSegments.length > 0
        ? [...new Set(firstSegments)].sort((a, b) =>
          firstSegments.filter(s => s === b).length - firstSegments.filter(s => s === a).length
        )[0]
        : '';

      pickFolder: while (true) {
        const folderChoice = await select({
          message: 'Where should the test cycles be placed?',
          choices: [
            {
              name: `Platform root folder (${platform.platform_name})`,
              value: 'root',
            },
            ...(descendants.length > 0
              ? [{
                name: 'Existing feature folder',
                value: 'existing',
              }]
              : []),
            {
              name: 'Create new feature folder',
              value: 'create',
            },
            new Separator('  ── Navigation ──'),
            {
              name: '← Go back (re-pick platform)',
              value: 'back-platform',
            },
          ],
        });

        if (folderChoice === 'back-platform') {
          continue pickPlatform;
        }

        if (folderChoice === 'root') {
          targetFolderId = platform.zephyr_test_cycle_folder_id;
          pendingFolderName = null;
          console.log(`   Using platform root folder: ${platform.zephyr_test_cycle_folder_id}`);
          break pickFolder;
        }

        if (folderChoice === 'existing') {
          const selectedFolder = await select({
            message: 'Select a feature folder:',
            choices: [
              ...descendants.map(f => ({
                name: f.path,
                value: f.id,
              })),
              new Separator('  ── Navigation ──'),
              {
                name: '← Go back',
                value: 'back',
              },
            ],
            pageSize: 20,
          });

          if (selectedFolder === 'back') {
            continue pickFolder;
          }

          targetFolderId = selectedFolder;
          pendingFolderName = null;
          const folderName = descendants.find(f => f.id === selectedFolder)?.name || selectedFolder;
          console.log(`   Using existing folder: "${folderName}" (ID: ${targetFolderId})`);
          break pickFolder;
        }

        // folderChoice === 'create'
        nameInput: while (true) {
          const folderName = await input({
            message: 'Enter a name for the new feature folder:',
            default: suggestedFolderName,
          });
          const finalName = folderName.trim() || suggestedFolderName;

          const confirmChoice = await select({
            message: `Create folder "${finalName}" under ${platform.platform_name}?`,
            choices: [
              {
                name: 'Yes, create',
                value: 'confirm',
              },
              {
                name: 'No, change name',
                value: 'rename',
              },
              {
                name: 'Cancel, go back',
                value: 'back',
              },
            ],
          });

          if (confirmChoice === 'back') {
            continue pickFolder;
          }

          if (confirmChoice === 'rename') {
            continue nameInput;
          }

          // confirmChoice === 'confirm'
          pendingFolderName = finalName;

          if (!executeMode) {
            targetFolderId = null;
            console.log(`   Would create new folder: "${finalName}" under ${platform.platform_name}`);
          } else {
            const newFolder = await createFolder({
              projectKey: squad.zephyr_key,
              name: finalName,
              parentId: platform.zephyr_test_cycle_folder_id,
              folderType: 'TEST_CYCLE',
            });
            targetFolderId = newFolder.id;
            allFolders.push(newFolder);
            console.log(`   Created new folder: "${finalName}" (ID: ${targetFolderId})`);

            const existing = await db('platform_features')
              .where({
                platform_id: platform.id,
                zephyr_folder_id: newFolder.id,
              })
              .first();

            if (!existing) {
              await db('platform_features').insert({
                platform_id: platform.id,
                feature_name: finalName,
                zephyr_folder_id: newFolder.id,
                is_active: true,
              });
            } else {
              await db('platform_features')
                .where({ id: existing.id })
                .update({
                  feature_name: finalName,
                  updated_at: db.fn.now(),
                });
            }
          }

          break pickFolder;
        }
      }

      break pickPlatform;
    }

    // Get existing cycles for this platform
    const existingCycles = await getTestCyclesRecursive(allFolders, platform.zephyr_test_cycle_folder_id);

    // Step 4: Build migration plan
    const migrationPlan = [];

    for (const entry of selectedEntries) {
      const parsed = parseSpecFilePath(entry.filePath);
      if (!parsed) {
        console.log(`   ⚠️  Cannot parse path: ${entry.filePath}`);
        continue;
      }

      migrationPlan.push({
        cycleName: parsed.cycleName,
        tcKeys: entry.tcKeys.sort(),
        specFile: entry.filePath,
      });
    }

    // Merge entries with same cycleName
    const mergedPlan = new Map();
    for (const entry of migrationPlan) {
      if (!mergedPlan.has(entry.cycleName)) {
        mergedPlan.set(entry.cycleName, {
          ...entry,
          tcKeys: [...entry.tcKeys],
          specFiles: [entry.specFile],
        });
      } else {
        const existing = mergedPlan.get(entry.cycleName);
        existing.tcKeys.push(...entry.tcKeys);
        existing.specFiles.push(entry.specFile);
      }
    }

    for (const entry of mergedPlan.values()) {
      entry.tcKeys = [...new Set(entry.tcKeys)].sort();
    }

    const entries = [...mergedPlan.values()].sort((a, b) => a.cycleName.localeCompare(b.cycleName));
    const totalTCsInPlan = entries.reduce((sum, e) => sum + e.tcKeys.length, 0);

    console.log(`\n   📋 Migration plan: ${entries.length} cycles, ${totalTCsInPlan} TCs → ${platform.platform_name}\n`);

    for (const entry of entries) {
      const existing = findExistingCycle(entry.cycleName, existingCycles);
      const status = existing ? `exists: ${existing.key}` : 'NEW';
      console.log(`      ${status === 'NEW' ? '🆕' : '♻️ '} "${entry.cycleName}" → ${entry.tcKeys.length} TCs (${status})`);
    }

    if (!executeMode) {
      console.log('\n━━━ Summary ━━━');
      if (pendingFolderName) {
        console.log(`   New folder to create: "${pendingFolderName}" under ${platform.platform_name}`);
      }
      console.log(`   Cycles to create/reuse: ${entries.length}`);
      console.log(`   Test cases to migrate: ${totalTCsInPlan}`);
      console.log('\n   ℹ️  This was a DRY RUN. Add --execute to perform the migration.');
      console.log('');
      return;
    }

    // Step 5: Execute
    // Create pending folder first (deferred from dry-run)
    if (pendingFolderName && !targetFolderId) {
      console.log(`\n   📁 Creating folder: "${pendingFolderName}" under ${platform.platform_name}...`);
      try {
        const newFolder = await createFolder({
          projectKey: squad.zephyr_key,
          name: pendingFolderName,
          parentId: platform.zephyr_test_cycle_folder_id,
          folderType: 'TEST_CYCLE',
        });
        targetFolderId = newFolder.id;
        allFolders.push(newFolder);
        console.log(`   Created new folder: "${pendingFolderName}" (ID: ${targetFolderId})`);

        const existing = await db('platform_features')
          .where({
            platform_id: platform.id,
            zephyr_folder_id: newFolder.id,
          })
          .first();

        if (!existing) {
          await db('platform_features').insert({
            platform_id: platform.id,
            feature_name: pendingFolderName,
            zephyr_folder_id: newFolder.id,
            is_active: true,
          });
        } else {
          await db('platform_features')
            .where({ id: existing.id })
            .update({
              feature_name: pendingFolderName,
              updated_at: db.fn.now(),
            });
        }
      } catch (err) {
        console.log(`   ❌ Failed to create folder "${pendingFolderName}": ${err.response?.data?.message || err.message}`);
        console.log('   Falling back to platform root folder.');
        targetFolderId = platform.zephyr_test_cycle_folder_id;
      }
    }

    console.log('\n   🚀 Executing migration...');
    let created = 0;
    let failed = 0;

    for (const entry of entries) {
      let cycle = findExistingCycle(entry.cycleName, existingCycles);

      if (!cycle) {
        try {
          cycle = await createTestCycle({
            projectKey: squad.zephyr_key,
            name: entry.cycleName,
            folderId: targetFolderId,
          });
          console.log(`      ✅ Created cycle: ${cycle.key} "${entry.cycleName}"`);
          existingCycles.push({
            ...cycle,
            name: cycle.name || entry.cycleName,
          });
          await sleep(API_DELAY_MS);
        } catch (err) {
          console.log(`      ❌ Failed to create cycle "${entry.cycleName}": ${err.response?.data?.message || err.message}`);
          failed += entry.tcKeys.length;
          continue;
        }
      } else {
        console.log(`      ♻️  Reusing cycle: ${cycle.key} "${entry.cycleName}"`);
      }

      for (const tcKey of entry.tcKeys) {
        try {
          await createTestExecution({
            projectKey: squad.zephyr_key,
            testCycleKey: cycle.key,
            testCaseKey: tcKey,
          });
          created++;
          await sleep(API_DELAY_MS);
        } catch (err) {
          console.log(`      ❌ ${tcKey}: ${err.response?.data?.message || err.message}`);
          failed++;
        }
      }

      console.log(`      📦 ${entry.tcKeys.length} TCs added to ${cycle.key}`);
    }

    console.log('\n━━━ Summary ━━━');
    console.log(`   Cycles processed: ${entries.length}`);
    console.log(`   Successfully added: ${created}`);
    console.log(`   Failed: ${failed}`);
    console.log('');
  } finally {
    destroyConnection();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  destroyConnection();
  process.exit(1);
});

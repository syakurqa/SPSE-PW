/* eslint-disable no-console */
/**
 * Coverage Sync Script
 *
 * Fetches regression suite data from Zephyr Scale API, calculates automation coverage
 * at feature, platform, and squad levels, and writes daily snapshots to PostgreSQL.
 *
 * Usage: npm run coverage:sync --workspace=@automation/reporting-module [--squad=KEY] [--date=YYYY-MM-DD]
 */

import args from 'args';
import { getConnection, destroyConnection } from '../lib/database.js';
import {
  getFolders,
  getTestExecutions,
  getTestCyclesByFolder,
} from '../lib/zephyr-api.js';
import {
  getAllDescendantFoldersWithPath,
  extractTestCaseKey,
  getTestCaseStatusMap,
} from '../lib/zephyr-utils.js';

args.option('date', 'Snapshot date (YYYY-MM-DD). Defaults to today.');
args.option('squad', 'Filter by squad zephyr_key (e.g. PBF2) or squad database id');

async function upsertSnapshot(db, data) {
  const conflictColumns = [
    'snapshot_date',
    'dimension_level',
    'platform_id',
    'feature_id',
    'squad_id',
  ];

  await db('coverage_snapshots')
    .insert(data)
    .onConflict(conflictColumns)
    .merge({
      total_test_cases: data.total_test_cases,
      automated_test_cases: data.automated_test_cases,
      zephyr_sync_timestamp: data.zephyr_sync_timestamp,
    });
}

async function syncCoverage() {
  const argv = process.argv.filter(a => a !== '--');
  const flags = args.parse(argv);

  const db = getConnection();
  const today = flags.date || new Date().toISOString().split('T')[0];

  if (flags.date && !/^\d{4}-\d{2}-\d{2}$/.test(flags.date)) {
    throw new Error(`Invalid --date format: "${flags.date}". Expected YYYY-MM-DD.`);
  }

  const syncTimestamp = new Date().toISOString();

  const [syncLogEntry] = await db('sync_log')
    .insert({
      sync_type: 'COVERAGE_SYNC',
      status: 'STARTED',
      started_at: syncTimestamp,
    })
    .returning('*');

  console.log(`\n===== Coverage Sync Started (${today}) =====\n`);

  let totalProcessed = 0;
  let totalErrors = 0;

  let squads = await db('squads').where({ is_active: true });

  if (flags.squad) {
    const isNumeric = /^\d+$/.test(flags.squad);
    squads = squads.filter(s =>
      isNumeric
        ? s.id === Number(flags.squad)
        : s.zephyr_key === flags.squad
    );
    if (squads.length === 0) {
      console.log(`No active squad found for "${flags.squad}"`);
      destroyConnection();
      return;
    }
  }

  for (const squad of squads) {
    const platforms = await db('platforms')
      .join('squad_platform_ownership', 'platforms.id', 'squad_platform_ownership.platform_id')
      .where({ 'squad_platform_ownership.squad_id': squad.id })
      .whereNull('squad_platform_ownership.effective_to')
      .whereNotNull('platforms.zephyr_test_cycle_folder_id')
      .where({ 'platforms.is_active': true })
      .select('platforms.*');

    if (platforms.length === 0) {
      console.log(`⏭️  Skipping ${squad.squad_name} — no configured platforms`);
      continue;
    }

    console.log(`\n--- Processing: ${squad.squad_name} (${squad.zephyr_key}) ---`);

    try {
      const allFolders = await getFolders(squad.zephyr_key);
      const automatedStatusId = squad.zephyr_status_automated
        ? Number(squad.zephyr_status_automated) : null;
      const maintenanceStatusId = squad.zephyr_status_need_maintenance
        ? Number(squad.zephyr_status_need_maintenance) : null;
      let squadTotalTC = 0;
      let squadAutomatedTC = 0;

      for (const platform of platforms) {
        const pid = Number(platform.zephyr_test_cycle_folder_id);
        const parent = allFolders.filter(f => Number(f.id) === pid);
        if (parent.length === 0) {
          console.log(`   ⚠️  Platform ${platform.platform_name}: folder ID ${pid} not found in Zephyr project ${squad.zephyr_key}, skipping`);
          continue;
        }
        let allDescendants = [];
        allDescendants.push({
          id: parent[0].id,
          name: parent[0].name,
          path: parent[0].name,
          parentId: null
        });
        allDescendants = allDescendants.concat(getAllDescendantFoldersWithPath(allFolders, platform.zephyr_test_cycle_folder_id));
        let platformTotalTC = 0;
        let platformAutomatedTC = 0;

        // 1) Build feature rows (folders that have direct cycles) and upsert platform_features
        const featureRows = [];
        const activeFeatureIds = [];

        for (const folder of allDescendants) {
          const directCycles = await getTestCyclesByFolder(folder.id);
          if (directCycles.length === 0) continue;

          // Upsert feature by folder ID
          let feature = await db('platform_features')
            .where({
              platform_id: platform.id,
              zephyr_folder_id: folder.id
            })
            .first();

          if (!feature) {
            [feature] = await db('platform_features')
              .insert({
                platform_id: platform.id,
                feature_name: folder.path,
                zephyr_folder_id: folder.id,
                is_active: true,
              })
              .returning('*');
          } else if (feature.feature_name !== folder.path) {
            await db('platform_features')
              .where({ id: feature.id })
              .update({
                is_active: true,
                feature_name: folder.path,
                updated_at: db.fn.now()
              });
            feature.feature_name = folder.path;
          } else if (feature) {
            await db('platform_features')
              .where({ id: feature.id })
              .update({
                is_active: true,
                updated_at: db.fn.now()
              });
          }

          featureRows.push({
            feature,
            cycles: directCycles,
            folderId: folder.id
          });
          activeFeatureIds.push(feature.id);
        }

        // 2) Full replace feature_test_cycles for this platform's features and re-populate cycle_test_cases
        const featureIds = featureRows.map(r => r.feature.id);
        if (featureIds.length > 0) {
          await db('feature_test_cycles').whereIn('feature_id', featureIds).del();

          for (const { feature, cycles } of featureRows) {
            for (const cycle of cycles) {
              const [cycleRow] = await db('feature_test_cycles')
                .insert({
                  feature_id: feature.id,
                  zephyr_cycle_key: cycle.key,
                  cycle_name: cycle.name,
                  synced_at: syncTimestamp,
                })
                .returning('*');

              // Fetch executions once per cycle and persist test case keys
              const executions = await getTestExecutions(cycle.key);
              const testCaseKeys = executions.map(e => extractTestCaseKey(e)).filter(Boolean);
              const uniqueKeys = [...new Set(testCaseKeys)];

              if (uniqueKeys.length > 0) {
                // Get status map for this cycle's test cases
                const statusMap = await getTestCaseStatusMap(uniqueKeys);

                const CHUNK = 500;
                for (let i = 0; i < uniqueKeys.length; i += CHUNK) {
                  const chunk = uniqueKeys.slice(i, i + CHUNK);
                  await db('cycle_test_cases').insert(
                    chunk.map(k => {
                      const statusId = statusMap.get(k);
                      const isAutomated = statusId === automatedStatusId || statusId === maintenanceStatusId;
                      return {
                        cycle_id: cycleRow.id,
                        test_case_key: k,
                        synced_at: syncTimestamp,
                        status: isAutomated ? 'AUTOMATED' : 'NOT_AUTOMATED'
                      };
                    })
                  );
                }
              }
            }
          }
        }

        // Deactivate orphaned features (no longer have cycles)
        await db('platform_features')
          .where({
            platform_id: platform.id,
            is_active: true
          })
          .whereNotIn('id', activeFeatureIds.length > 0 ? activeFeatureIds : [0])
          .update({
            is_active: false,
            updated_at: db.fn.now()
          });

        // 3) Compute coverage metrics USING DB (aggregate unique test_case_keys under each feature including descendants)
        for (const { feature, folderId } of featureRows) {
          // find feature ids that correspond to those folders
          const descendantFeatures = await db('platform_features')
            .where({ platform_id: platform.id })
            .where('zephyr_folder_id', folderId)
            .select('id');
          const descendantFeatureIds = descendantFeatures.map(r => r.id);

          let featureTotalKeys = 0;
          let featureAutomatedKeys = 0;

          if (descendantFeatureIds.length > 0) {
            const ftcRows = await db('feature_test_cycles').whereIn('feature_id', descendantFeatureIds).select('id');
            const cycleIds = ftcRows.map(r => r.id);

            if (cycleIds.length > 0) {
              const keyRows = await db('cycle_test_cases')
                .whereIn('cycle_id', cycleIds)
                .distinct('test_case_key');

              const keys = keyRows.map(r => r.test_case_key);
              featureTotalKeys = keys.length;
              if (keys.length > 0 && (automatedStatusId || maintenanceStatusId)) {
                const statusMap = await getTestCaseStatusMap(keys);
                featureAutomatedKeys = keys.filter(key => {
                  const statusId = statusMap.get(key);
                  return statusId === automatedStatusId || statusId === maintenanceStatusId;
                }).length;
              }
            }
          }

          await upsertSnapshot(db, {
            snapshot_date: today,
            platform_id: platform.id,
            feature_id: feature.id,
            squad_id: squad.id,
            dimension_level: 'FEATURE',
            total_test_cases: featureTotalKeys,
            automated_test_cases: featureAutomatedKeys,
            zephyr_sync_timestamp: syncTimestamp,
          });

          platformTotalTC += featureTotalKeys;
          platformAutomatedTC += featureAutomatedKeys;

          const pctFeature = featureTotalKeys > 0
            ? ((featureAutomatedKeys / featureTotalKeys) * 100).toFixed(1) : '0.0';

          // Log cycles count using DB-derived cycle count for the feature
          const featureCycleCount = await db('feature_test_cycles')
            .where({ feature_id: feature.id })
            .count('* as cnt')
            .first();

          console.log(`   📋 ${feature.feature_name}: ${featureAutomatedKeys}/${featureTotalKeys} (${pctFeature}%) [${featureCycleCount.cnt} cycles]`);
        }

        // Platform snapshot
        await upsertSnapshot(db, {
          snapshot_date: today,
          platform_id: platform.id,
          feature_id: null,
          squad_id: squad.id,
          dimension_level: 'PLATFORM',
          total_test_cases: platformTotalTC,
          automated_test_cases: platformAutomatedTC,
          zephyr_sync_timestamp: syncTimestamp,
        });

        squadTotalTC += platformTotalTC;
        squadAutomatedTC += platformAutomatedTC;

        const pctPlatform = platformTotalTC > 0
          ? ((platformAutomatedTC / platformTotalTC) * 100).toFixed(1) : '0.0';
        console.log(`   📂 ${platform.platform_name}: ${platformAutomatedTC}/${platformTotalTC} (${pctPlatform}%)`);
      }

      await upsertSnapshot(db, {
        snapshot_date: today,
        platform_id: null,
        feature_id: null,
        squad_id: squad.id,
        dimension_level: 'SQUAD',
        total_test_cases: squadTotalTC,
        automated_test_cases: squadAutomatedTC,
        zephyr_sync_timestamp: syncTimestamp,
      });

      const pctSquad = squadTotalTC > 0
        ? ((squadAutomatedTC / squadTotalTC) * 100).toFixed(1) : '0.0';
      console.log(`✅ ${squad.squad_name}: ${squadAutomatedTC}/${squadTotalTC} (${pctSquad}%)`);
      totalProcessed++;
    } catch (err) {
      console.error(`❌ Error processing ${squad.squad_name}:`, err.message);
      totalErrors++;
    }
  }

  await db('sync_log').where({ id: syncLogEntry.id }).update({
    status: 'COMPLETED',
    details: JSON.stringify({
      processed: totalProcessed,
      errors: totalErrors,
    }),
    completed_at: new Date().toISOString(),
  });

  console.log(`\n===== Coverage Sync Completed: ${totalProcessed} squads processed, ${totalErrors} errors =====\n`);
  destroyConnection();
}

syncCoverage().catch(err => {
  console.error('Coverage sync failed:', err);
  destroyConnection();
  process.exit(1);
});

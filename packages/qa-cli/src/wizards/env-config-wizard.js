/* eslint-disable no-console */
import { checkConfigFiles } from '../utils/config-manager.js';

export async function runEnvConfigWizard(env) {
  console.log(`\n📋 Checking ${env} Environment Configuration`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const status = await checkConfigFiles(env);

    if (status.env) {
      console.log(`✓ env.${env.toLowerCase()}.json — already exists`);
    } else {
      console.log(`✗ env.${env.toLowerCase()}.json — missing`);
    }

    if (status.db) {
      console.log(`✓ db.${env.toLowerCase()}.json — already exists`);
    } else {
      console.log(`✗ db.${env.toLowerCase()}.json — missing`);
    }

    if (status.mobile) {
      console.log(`✓ mobile.env.${env.toLowerCase()}.json — already exists`);
    } else {
      console.log(`✗ mobile.env.${env.toLowerCase()}.json — missing`);
    }

    const missing = [];
    if (!status.env) missing.push(`env.${env.toLowerCase()}.json`);
    if (!status.db) missing.push(`db.${env.toLowerCase()}.json`);
    if (!status.mobile) missing.push(`mobile.env.${env.toLowerCase()}.json`);

    if (missing.length === 0) {
      console.log('\n✓ All config files present.\n');
      return true;
    } else {
      console.log('\n⚠ Missing config files:');
      for (const f of missing) {
        console.log(`  ✗ packages/common-module/config/${f}`);
      }
      console.log('\n  Create them manually with values from the team Google Sheet.');
      console.log('  See README.md for config format and conventions.\n');
      return false;
    }
  } catch (error) {
    console.error(`\n❌ Config check failed: ${error.message || error}`);
    throw error;
  }
}
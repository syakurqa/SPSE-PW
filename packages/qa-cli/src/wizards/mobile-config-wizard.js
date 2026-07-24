/* eslint-disable no-console */
import { loadConfig, saveMobileEnvVars } from '../utils/config-manager.js';

export async function runMobileConfigWizard(env) {
  const targetEnv = env || process.env.ENV || 'SIT';

  console.log('\n📱 Mobile Testing Configuration');
  console.log('═════════════════════════════════════════════════════════\n');

  try {
    const mobileConfig = await loadConfig(targetEnv, 'mobile.env');

    if (!mobileConfig) {
      console.log(`✗ mobile.env.${targetEnv.toLowerCase()}.json — not found`);
      console.log('  Create it manually under:');
      console.log('  packages/common-module/config/\n');
      console.log('  Reference the team Google Sheet for real values.');
      console.log('  See README.md for config format.\n');
      return;
    }

    console.log(`✓ Loaded mobile.env.${targetEnv.toLowerCase()}.json`);
    console.log(`  Appium Server : ${mobileConfig.appiumServer || 'http://localhost:4723/wd/hub'}`);
    console.log(`  Device Type   : ${mobileConfig.deviceType || 'android'}`);
    console.log(`  App Path      : ${mobileConfig.appPath || '(cloud/not set)'}\n`);

    const envVars = {
      deviceType: mobileConfig.deviceType || 'android',
      runType: 'LOCAL',
      squad: 'BFI_MOBILE',
      specPattern: 'bfi-mobile/tests/**/*.spec.js',
      appPath: mobileConfig.appPath || ''
    };

    await saveMobileEnvVars(envVars);
    console.log('✓ Mobile .env file written\n');
    console.log('  Edit .env at repo root to change RUN_TYPE, SQUAD, or SPEC_PATTERN.\n');
  } catch (error) {
    console.error(`\n❌ Mobile configuration failed: ${error.message || error}`);
    throw error;
  }
}

/**
 * Check mobile configuration and prompt if incomplete
 */
export async function checkMobileConfig() {
  const targetEnv = process.env.ENV || 'SIT';
  const mobileConfig = await loadConfig(targetEnv, 'mobile.env');

  if (!mobileConfig) {
    console.log(`\n⚠ Mobile config not found (mobile.env.${targetEnv.toLowerCase()}.json)`);
    console.log('  Run: npm run qa:setup\n');
    return false;
  }

  return true;
}
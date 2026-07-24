/* eslint-disable no-console */
import { Command } from 'commander';
import { loadConfig, checkConfigFiles } from '../utils/config-manager.js';
import { loadMobileEnvVars } from '../utils/config-manager.js';

export function runConfigCommand(program) {
  const configCommand = new Command('config')
    .description('Manage configuration and settings')
    .argument('[action]', 'Action: show, set, get, reset, validate, mobile')
    .argument('[key]', 'Configuration key')
    .argument('[value]', 'Configuration value')
    .action(async (action, key, value) => {
      const env = process.env.ENV || 'SIT';

      if (!action || action === 'show') {
        await showConfig(env);
      } else if (action === 'mobile') {
        await showMobileConfig();
      } else if (action === 'validate') {
        await validateConfig(env);
      } else {
        console.log('Usage: npm run qa:config [action] [key] [value]');
        console.log('Actions:');
        console.log('  show       - Show current configuration');
        console.log('  mobile      - Show mobile configuration');
        console.log('  validate    - Validate configuration');
      }
    });

  program.addCommand(configCommand);
}

export async function showConfig(env) {
  console.log(`\n📋 Configuration for ${env}`);

  const configStatus = await checkConfigFiles(env);

  console.log(`\nEnvironment Config:`);
  if (configStatus.env) {
    const envConfig = await loadConfig(env, 'env');
    if (envConfig) {
      console.log(`  ✓ env.${env.toLowerCase()}.json exists`);
      console.log(`    API URL: ${envConfig.apiUrl || 'Not set'}`);
      console.log(`    Timeout:   ${envConfig.timeout || 'Not set'}ms`);
    }
  } else {
    console.log(`  ✗ env.${env.toLowerCase()}.json missing`);
    console.log(`    Run: npm run qa:setup`);
  }

  console.log(`\nDatabase Config:`);
  if (configStatus.db) {
    const dbConfig = await loadConfig(env, 'db');
    if (dbConfig) {
      console.log(`  ✓ db.${env.toLowerCase()}.json exists`);
      console.log(`    Host:      ${dbConfig.connection?.host || 'Not set'}`);
      console.log(`    Database:  ${dbConfig.connection?.database || 'Not set'}`);
    }
  } else {
    console.log(`  ✗ db.${env.toLowerCase()}.json missing`);
    console.log(`    Run: npm run qa:setup`);
  }

  console.log(`\nMobile Config:`);
  if (configStatus.mobile) {
    const mobileConfig = await loadConfig(env, 'mobile');
    if (mobileConfig) {
      console.log(`  ✓ mobile.env.${env.toLowerCase()}.json exists`);
      console.log(`    Appium: ${mobileConfig.appiumServer || 'Not set'}`);
      console.log(`    Device:  ${mobileConfig.deviceType || 'Not set'}`);
    }
  } else {
    console.log(`  ✗ mobile.env.${env.toLowerCase()}.json missing`);
    console.log(`    Run: npm run qa:setup`);
  }
}

export async function showMobileConfig() {
  console.log('\n📱 Mobile Testing Configuration');

  const mobileEnvVars = await loadMobileEnvVars();

  if (Object.keys(mobileEnvVars).length === 0) {
    console.log('  ✗ No mobile environment variables configured');
    console.log('    Run: npm run qa:test mobile');
    console.log('    Or: npm run qa:setup');
  } else {
    console.log(`  ✓ .env file found`);
    console.log(`    DEVICE_TYPE:   ${mobileEnvVars.DEVICE_TYPE || 'Not set'}`);
    console.log(`    RUN_TYPE:      ${mobileEnvVars.RUN_TYPE || 'Not set'}`);
    console.log(`    SQUAD:         ${mobileEnvVars.SQUAD || 'Not set'}`);
    console.log(`    SPEC_PATTERN:   ${mobileEnvVars.SPEC_PATTERN || 'Not set'}`);
    console.log(`    APP:           ${mobileEnvVars.APP ? 'Configured' : 'Not set'}`);
  }
}

async function validateConfig(env) {
  console.log(`\n🔍 Validating ${env} configuration...`);

  const configStatus = await checkConfigFiles(env);
  let isValid = true;

  if (!configStatus.env) {
    console.log('  ✗ Environment config missing');
    console.log('    Run: npm run qa:setup');
    isValid = false;
  }

  if (!configStatus.db) {
    console.log('  ✗ Database config missing');
    console.log('    Run: npm run qa:setup');
    isValid = false;
  }

  if (!configStatus.mobile) {
    console.log('  ⚠ Mobile config missing (optional)');
    console.log('    Run: npm run qa:setup --skip-db');
  }

  if (isValid) {
    console.log('  ✓ Configuration is valid');
  }

  process.exit(isValid ? 0 : 1);
}
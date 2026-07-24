/* eslint-disable no-console */
import { select, input, confirm } from '@inquirer/prompts';
import { runApiTests, runWebTests, runMobileTests } from '../utils/executor.js';
import { checkConfigFiles } from '../utils/config-manager.js';
import { checkMobileConfig } from './mobile-config-wizard.js';
import fs from 'fs';
import path from 'path';
import { getRepoRoot } from '../utils/executor.js';

const LAST_RUN_FILE = '.qa-last-run.json';

function saveLastRun(testType, options) {
  try {
    const filePath = path.join(getRepoRoot(), LAST_RUN_FILE);
    fs.writeFileSync(filePath, JSON.stringify({ testType, options, timestamp: new Date().toISOString() }, null, 2));
  } catch {
    // silently ignore save failures
  }
}

function loadLastRun() {
  try {
    const filePath = path.join(getRepoRoot(), LAST_RUN_FILE);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // ignore
  }
  return null;
}

export async function runTestWizard(options = {}) {
  console.log('\n🧪 Test Execution Wizard');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check for previous run
  const lastRun = loadLastRun();

  try {
    // Step 1: Select test type
    const testType = await selectTestType(lastRun);
    if (testType === 'back') return;
    if (testType === 'rerun') {
      console.log(`\n↻ Re-running previous ${lastRun.testType.toUpperCase()} tests (${lastRun.timestamp})...\n`);

      // Run LOCAL pre-flight checks for mobile reruns
      if (lastRun.testType === 'mobile' && lastRun.options.runType === 'LOCAL') {
        await checkLocalPrerequisites(lastRun.options);
      }

      await executeTests(lastRun.testType, lastRun.options);
      saveLastRun(lastRun.testType, lastRun.options);
      console.log('\n═══════════════════════════════════════════════════════════');
      return;
    }

    // Step 2: Configure test options
    const testOptions = await configureTestOptions(testType, options);

    // Step 3: Execute tests
    await executeTests(testType, testOptions);
    saveLastRun(testType, testOptions);

    console.log('\n═══════════════════════════════════════════════════════════');
  } catch (error) {
    console.error(`\n❌ Test execution failed: ${error.message}`);
    throw error;
  }
}

async function selectTestType(lastRun) {
  console.log('Step 1: Select Test Type\n');

  const choices = [
    { name: 'API Tests', value: 'api', description: 'API endpoint testing' },
    { name: 'Web Tests', value: 'web', description: 'UI testing with Playwright' },
    { name: 'Mobile Tests', value: 'mobile', description: 'Mobile app testing' },
    { name: 'All Tests', value: 'all', description: 'Run API test + web tests' }
  ];

  if (lastRun) {
    const filterLabel = lastRun.options.file || lastRun.options.tag || lastRun.options.grep || 'all';
    const summary = `${lastRun.testType.toUpperCase()} | env:${lastRun.options.env || 'SIT'} | ${filterLabel} | ${lastRun.timestamp}`;
    choices.unshift({ name: `↻ Re-run previous (${summary})`, value: 'rerun' });
  }

  choices.push({ name: '← Back', value: 'back' });

  const choice = await select({
    message: 'Which type of tests do you want to run?',
    choices
  });

  return choice;
}

async function configureTestOptions(testType, cliOptions = {}) {
  console.log('Step 2: Configure Test Options\n');

  const options = {
    env: cliOptions.env,
    headed: cliOptions.headed,
    ui: cliOptions.ui,
    tag: cliOptions.tag,
    file: cliOptions.file,
    grep: cliOptions.grep,
    workers: cliOptions.workers
  };

  // Environment selection
  if (!options.env) {
    options.env = await select({
      message: 'Select environment:',
      choices: [
        { name: 'SIT (System Integration Testing)', value: 'SIT' },
        { name: 'UAT (User Acceptance Testing)', value: 'UAT' }
      ]
    });
  }

  // Verify config files exist for selected environment
  const configStatus = await checkConfigFiles(options.env);
  if (!configStatus.env) {
    console.log(`\n✗ env.${options.env.toLowerCase()}.json — not found`);
    console.log('  Create it manually under:');
    console.log('  packages/common-module/config/');
    console.log('  Reference the team Google Sheet for real values.\n');
    console.log('  Re-run: npm run qa:setup\n');
    throw new Error(`Environment config missing for ${options.env}`);
  }

  // Browser mode for web tests only (not relevant for API or mobile)
  if (testType === 'web') {
    if (!options.headed && !options.ui) {
      const browserMode = await select({
        message: 'Browser mode:',
        choices: [
          { name: 'Headless (default)', value: 'headless' },
          { name: 'Headed (visible browser)', value: 'headed' },
          { name: 'UI mode (interactive)', value: 'ui' }
        ]
      });

      if (browserMode === 'headed') {
        options.headed = true;
      } else if (browserMode === 'ui') {
        options.ui = true;
      }
    }
  }

  // Workers configuration
  if (!options.workers) {
    const workers = await input({
      message: 'Number of parallel workers (1-8):',
      default: '4',
      validate: value => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 8) {
          return 'Must be a number between 1 and 8';
        }
        return true;
      }
    });

    options.workers = parseInt(workers);
  }

  // Test filtering options
  if (!options.tag && !options.file && !options.grep) {
    const filterChoice = await select({
      message: 'Test filtering:',
      choices: [
        { name: 'Run all tests', value: 'all' },
        { name: 'Run by tag', value: 'tag' },
        { name: 'Run by name pattern', value: 'grep' },
        { name: 'Run specific file', value: 'file' }
      ]
    });

    if (filterChoice === 'tag') {
      options.tag = await input({
        message: 'Enter test tag (e.g., @smoke, @regression):',
        default: '@smoke',
        validate: value => {
          if (!value || value.trim() === '') {
            return 'Tag is required';
          }
          if (!value.startsWith('@')) {
            return 'Tag must start with @';
          }
          return true;
        }
      });
    } else if (filterChoice === 'grep') {
      options.grep = await input({
        message: 'Enter test name pattern:',
        default: 'approval',
        validate: value => {
          if (!value || value.trim() === '') {
            return 'Pattern is required';
          }
          return true;
        }
      });
    } else if (filterChoice === 'file') {
      options.file = await input({
        message: 'Enter test file path:',
        default: 'packages/web-automation/underwriting-platform',
        validate: value => {
          if (!value || value.trim() === '') {
            return 'File path is required';
          }
          return true;
        }
      });
    }
  }

  // Mobile-specific options
  if (testType === 'mobile') {
    await configureMobileOptions(options);
  }

  return options;
}

async function configureMobileOptions(options) {
  console.log('\n📱 Mobile-Specific Options\n');

  // Load defaults from mobile config file
  const targetEnv = options.env || process.env.ENV || 'SIT';
  const { loadConfig } = await import('../utils/config-manager.js');
  const mobileConfig = await loadConfig(targetEnv, 'mobile.env');

  // Check mobile configuration
  const mobileConfigured = await checkMobileConfig();
  if (!mobileConfigured) {
    console.log('⚠ Mobile config file not found (mobile.env.{env}.json)');
    const continueAnyway = await confirm({
      message: 'Continue anyway? (you will need to enter all values manually)',
      default: false
    });
    if (!continueAnyway) {
      throw new Error('Mobile testing configuration required');
    }
  }

  // Device type
  if (!options.deviceType) {
    options.deviceType = await select({
      message: 'Device type:',
      choices: [
        { name: 'Android', value: 'android' },
        { name: 'iOS', value: 'ios' }
      ],
      default: mobileConfig?.deviceType || 'android'
    });
  }

  // Run type
  if (!options.runType) {
    options.runType = await select({
      message: 'Run type:',
      choices: [
        { name: 'LOCAL — Appium + device/emulator', value: 'LOCAL' },
        { name: 'LAMBDA — LambdaTest cloud', value: 'LAMBDA' },
        { name: 'DEVICE-FARM — BFI Device Farm', value: 'DEVICE-FARM' }
      ]
    });
  }

  // App (required for all run types — format depends on run type)
  if (!options.appPath) {
    const defaultApp = mobileConfig?.appPath || '';
    const hint = options.runType === 'LOCAL'
      ? 'App path (.apk/.ipa):'
      : options.runType === 'DEVICE-FARM'
        ? 'App filename (e.g. file-1782443406108.apk):'
        : 'App ID / URL:';
    options.appPath = await input({
      message: hint,
      default: defaultApp,
      validate: value => {
        if (!value || value.trim() === '') {
          return `App is required for ${options.runType}`;
        }
        return true;
      }
    });
  }

  // Squad
  if (!options.squad) {
    options.squad = await input({
      message: 'Squad name:',
      default: 'BFI_MOBILE',
      validate: value => {
        if (!value || value.trim() === '') {
          return 'Squad name is required';
        }
        return true;
      }
    });
  }

  // Spec pattern
  if (!options.specPattern) {
    options.specPattern = await input({
      message: 'Test spec pattern:',
      default: 'bfi-mobile/tests/**/*.spec.js',
      validate: value => {
        if (!value || value.trim() === '') {
          return 'Spec pattern is required';
        }
        return true;
      }
    });
  }

  // LOCAL pre-flight: verify Appium server and device
  if (options.runType === 'LOCAL') {
    await checkLocalPrerequisites(options);
  }
}

async function waitForAppium() {
  const appiumServer = process.env.APPIUM_SERVER || 'http://localhost:4723';

  // Check if already running
  try {
    const res = await fetch(`${appiumServer}/status`);
    if (res.ok) {
      const body = await res.json();
      console.log(`✓ Appium server running (v${body.value?.build?.version || '?'})`);
      return;
    }
  } catch {
    // not reachable — start it
  }

  console.log(`✗ Appium server not reachable at ${appiumServer}`);
  console.log('Starting Appium server...');
  const { spawn } = await import('child_process');
  const appium = spawn('appium', [], { stdio: 'pipe', detached: false });

  // Wait for Appium to become ready (up to 30s)
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await fetch(`${appiumServer}/status`);
      if (res.ok) {
        const body = await res.json();
        console.log(`✓ Appium server started (v${body.value?.build?.version || '?'})`);
        // Store PID so we can kill it after tests
        process.env._APPIUM_PID = String(appium.pid);
        return;
      }
    } catch {
      // still starting
    }
  }

  console.log('⚠ Appium did not start within 30s. Check manually.\n');
}

async function waitForAndroidDevice() {
  const { execSync } = await import('child_process');

  // Verify adb is available
  try {
    execSync('adb version', { encoding: 'utf8', stdio: 'pipe' });
  } catch {
    console.log('⚠ adb not found — cannot check Android devices');
    console.log('  Install Android SDK and ensure adb is in PATH\n');
    return;
  }

  while (true) {
    try {
      const output = execSync('adb devices', { encoding: 'utf8' });
      const lines = output.trim().split('\n').filter(l => l && !l.startsWith('List'));
      const devices = lines.filter(l => l.includes('\tdevice'));

      if (devices.length > 0) {
        console.log(`✓ Connected Android devices: ${devices.length}`);
        devices.forEach(d => console.log(`    ${d.split('\t')[0]}`));
        return;
      }

      console.log('⚠ No Android devices connected.');
    } catch {
      console.log('⚠ adb command failed');
    }

    const retry = await confirm({
      message: 'Connect a device or start an emulator, then retry?',
      default: true
    });
    if (!retry) {
      console.log('  Proceeding without device check...\n');
      return;
    }
  }
}

async function checkLocalPrerequisites(options) {
  console.log('\n🔍 Checking local mobile prerequisites...\n');

  // Check Appium server — wait until it's running
  await waitForAppium();

  // Check connected devices
  if (options.deviceType === 'android') {
    await waitForAndroidDevice();
  } else if (options.deviceType === 'ios') {
    try {
      const { execSync } = await import('child_process');
      const output = execSync('xcrun xctrace list devices 2>&1 || instruments -s devices 2>&1', { encoding: 'utf8' });
      const simulators = output.split('\n').filter(l => l.includes('Simulator') && !l.includes('(Simulator)'));
      if (simulators.length > 0) {
        console.log(`✓ Available iOS simulators: ${simulators.length}`);
      } else {
        console.log('⚠ No iOS simulators found');
      }
    } catch {
      console.log('⚠ xcrun not available — cannot check iOS devices\n');
    }
  }

  console.log();
}

async function executeTests(testType, options) {
  console.log('Step 3: Execute Tests\n');

  const testSummary = {
    type: testType,
    env: options.env,
    browserMode: options.headed ? 'headed' : (options.ui ? 'ui' : 'headless'),
    workers: options.workers,
    filter: options.tag || options.grep || options.file || 'all'
  };

  console.log('Test Execution Summary:');
  console.log(`  Type:        ${testSummary.type.toUpperCase()}`);
  console.log(`  Environment:  ${testSummary.env}`);
  if (testType === 'web') {
    console.log(`  Browser mode: ${testSummary.browserMode}`);
  }
  console.log(`  Workers:      ${testSummary.workers}`);
  console.log(`  Filter:       ${testSummary.filter}`);

  if (testType === 'mobile') {
    console.log(`  Device type:  ${options.deviceType}`);
    console.log(`  Run type:     ${options.runType}`);
    console.log(`  Squad:        ${options.squad}`);
  }

  console.log('\nExecuting tests...\n');

  let result;
  if (testType === 'api') {
    result = await runApiTests(options);
  } else if (testType === 'web') {
    result = await runWebTests(options); // Await and capture result
  } else if (testType === 'mobile') {
    result = await runMobileTests(options);

    // Clean up auto-started Appium
    if (process.env._APPIUM_PID) {
      try { process.kill(Number(process.env._APPIUM_PID)); } catch {}
      delete process.env._APPIUM_PID;
    }
  } else if (testType === 'all') {
    // Run API tests first
    console.log('Running API tests...\n');
    const apiResult = await runApiTests(options);

    if (apiResult.success) {
      console.log('\n✓ API tests completed');
      console.log('\nRunning web tests...\n');
      result = await runWebTests(options);
    } else {
      result = apiResult;
    }
  }

  if (result.success) {
    console.log('\n✓ Test execution completed successfully');
    console.log('\nView test reports:');
    console.log('  • npm run qa:report api         # API reports');
    console.log('  • npm run qa:report web         # Web reports');
    console.log('  • npm run reporting:dashboard    # Dashboard');
  } else {
    console.error('\n✗ Test execution failed');
    console.log(`\nExit code: ${result.code}`);
    console.log('\nReview test output and logs for details.');
  }
}

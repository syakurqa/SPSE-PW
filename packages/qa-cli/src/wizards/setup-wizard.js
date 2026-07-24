/* eslint-disable no-console */
import { select, confirm } from '@inquirer/prompts';
import { executeNpmScript, checkCommandVersion } from '../utils/executor.js';
import fs from 'fs';
import { checkConfigFiles } from '../utils/config-manager.js';
import { runMobileConfigWizard } from './mobile-config-wizard.js';

export async function runSetupWizard(options = {}) {
  console.log('\n🚀 QA CLI Setup Wizard');
  console.log('═════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Environment Selection
    const selectedEnvs = await selectEnvironment();
    if (!selectedEnvs) return;

    // Step 2: Prerequisites Check
    await checkPrerequisites();


    // Step 3: Dependencies Installation
    if (!options.quick) {
      await installDependencies();
    }

    // Step 4: Playwright Browser Installation
    if (!options.skipBrowser) {
      await installBrowsers();
    }

    // Step 5: Environment Configuration — wait until all files exist
    for (const env of selectedEnvs) {
      await waitForConfigFiles(env);
    }

    // Step 6: Mobile Prerequisites
    await installMobilePrerequisites();

    // Step 7: Mobile Testing Setup
    await setupMobileTesting(selectedEnvs[0]);

    // Step 8: Validation
    await validateSetup();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎉 Setup Complete!\n');

    showNextSteps();
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    throw error;
  }
}

async function selectEnvironment() {
  console.log('Step 1: Environment Selection\n');

  const choice = await select({
    message: 'Which environment(s) do you want to configure?',
    choices: [
      { name: 'SIT (System Integration Testing)', value: 'SIT' },
      { name: 'UAT (User Acceptance Testing)', value: 'UAT' },
      { name: 'Both environments', value: 'both' },
      { name: '← Cancel', value: 'cancel' }
    ]
  });

  if (choice === 'cancel') return null;
  if (choice === 'both') return ['SIT', 'UAT'];
  return [choice];
}

async function checkPrerequisites() {
  console.log('Step 2: Prerequisites Check\n');

  // Node.js version check
  const node = await checkCommandVersion('node', ['--version']);
  if (node.found) {
    const major = parseInt(node.version.replace('v', '').split('.')[0]);
    if (major >= 20) {
      console.log(`✓ Node.js ${node.version} (>= 20 required)`);
    } else {
      console.log(`✗ Node.js ${node.version} — version 20 or higher required.`);
      throw new Error('Node.js >= 20 is required. Install via nvm: nvm install 20');
    }
  } else {
    throw new Error('Node.js not found. Install Node.js >= 20: https://nodejs.org');
  }

  // Git check
  const git = await checkCommandVersion('git', ['--version']);
  if (git.found) {
    console.log(`✓ Git found`);
  } else {
    throw new Error('Git not found. Install Git: brew install git');
  }

  console.log();
}
async function installDependencies() {
  console.log('Step 3: Dependencies Installation\n');

  const shouldInstall = await confirm({
    message: 'Install npm dependencies? This may take several minutes.',
    default: true
  });

  if (shouldInstall) {
    console.log('Installing all workspace dependencies...\n');

    const result = await executeNpmScript('install');

    if (result.success) {
      console.log('\n✓ Dependencies installed successfully\n');
    } else {
      throw new Error('Dependency installation failed');
    }
  }
}

async function installBrowsers() {
  console.log('Step 4: Playwright Browser Installation\n');

  // Check if Chromium is already installed
  const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH
    || `${process.env.HOME}/Library/Caches/ms-playwright`;
  const chromiumInstalled = fs.existsSync(cacheDir)
    && fs.readdirSync(cacheDir).some(d => d.startsWith('chromium-'));

  if (chromiumInstalled) {
    console.log('✓ Chromium browser already installed\n');
    return;
  }

  console.log('Chromium not found. Installing...');
  const result = await executeNpmScript('npx playwright install chromium');

  if (result.success) {
    console.log('\n✓ Browsers installed successfully\n');
  } else {
    throw new Error('Browser installation failed');
  }
}


async function waitForConfigFiles(env) {
  while (true) {
    const status = await checkConfigFiles(env);
    if (status.env && status.db && status.mobile) {
      console.log(`✓ All ${env} config files present\n`);
      return;
    }

    console.log(`\n⚠ Missing ${env} config files:`);
    if (!status.env) console.log(`  ✗ packages/common-module/config/env.${env.toLowerCase()}.json`);
    if (!status.db) console.log(`  ✗ packages/common-module/config/db.${env.toLowerCase()}.json`);
    if (!status.mobile) console.log(`  ✗ packages/common-module/config/mobile.env.${env.toLowerCase()}.json`);
    console.log('\n  Create them with values from the team Google Sheet.');
    console.log('  See README.md for config format.\n');

    const retry = await confirm({
      message: 'Retry after creating the files?',
      default: true
    });
    if (!retry) {
      throw new Error(`Config files required for ${env}. Re-run: npm run qa:setup`);
    }
  }
}

async function installMobilePrerequisites() {
  console.log('Step 6: Mobile Prerequisites\n');

  // Check Java JDK
  const java = await checkCommandVersion('java', ['-version']);
  if (java.found) {
    console.log(`✓ Java found (${java.version})`);
  } else {
    console.log('⚠ Java JDK not found. Install JDK 11+ for Android/Appium testing.');
  }

  // Check ANDROID_HOME
  if (process.env.ANDROID_HOME) {
    console.log(`✓ ANDROID_HOME set (${process.env.ANDROID_HOME})`);
  } else {
    console.log('⚠ ANDROID_HOME not set. Android device testing will not work.');
  }

  // Check Appium
  const appium = await checkCommandVersion('appium', ['--version']);
  if (appium.found) {
    console.log(`✓ Appium found (v${appium.version})`);
  } else {
    console.log('✗ Appium not found.');
    const installAppium = await confirm({
      message: 'Install Appium globally? (npm install -g appium)',
      default: true
    });
    if (installAppium) {
      console.log('Installing Appium...');
      const result = await executeNpmScript('install -g appium');
      if (result.success) {
        console.log('✓ Appium installed successfully');
      } else {
        console.log('⚠ Appium installation failed. Install manually: npm install -g appium');
      }
    } else {
      console.log('Skipped. Install manually: npm install -g appium');
    }
  }

  // Check Appium drivers
  const { spawn: sp } = await import('child_process');
  const driverOutput = await new Promise((resolve) => {
    const child = sp('appium', ['driver', 'list', '--installed'], { stdio: 'pipe' });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('close', () => resolve(out));
    child.on('error', () => resolve(''));
  });

  const hasUia2 = driverOutput.includes('uiautomator2');
  const hasXcui = driverOutput.includes('xcuitest');
  if (hasUia2) console.log('✓ Appium driver uiautomator2 installed');
  if (hasXcui) console.log('✓ Appium driver xcuitest installed');
  if (!hasUia2 || !hasXcui) {
    const missingDrivers = [];
    if (!hasUia2) missingDrivers.push('uiautomator2');
    if (!hasXcui) missingDrivers.push('xcuitest');
    console.log(`⚠ Missing Appium drivers: ${missingDrivers.join(', ')}`);
    const installDrivers = await confirm({
      message: `Install missing drivers? (appium driver install ${missingDrivers.join(' ')})`,
      default: true
    });
    if (installDrivers) {
      for (const driver of missingDrivers) {
        console.log(`Installing ${driver}...`);
        const result = await executeNpmScript(`npx appium driver install ${driver}`);
        if (result.success) {
          console.log(`✓ ${driver} installed`);
        } else {
          console.log(`⚠ ${driver} install failed. Run: appium driver install ${driver}`);
        }
      }
    }
  }

  // Check Appium Inspector (macOS GUI app, can't auto-install)
  const inspectorPaths = [
    '/Applications/Appium Inspector.app',
    '/Applications/Appium\\ Inspector.app'
  ];
  const inspectorFound = inspectorPaths.some(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  if (inspectorFound) {
    console.log('✓ Appium Inspector found');
  } else {
    console.log('⚠ Appium Inspector not found.');
    console.log('  Download from: https://github.com/appium/appium-inspector/releases');
  }

  console.log();
}

async function setupMobileTesting(env) {
  console.log('Step 7: Mobile Testing Setup\n');

  const shouldSetupMobile = await confirm({
    message: 'Do you want to configure mobile testing?',
    default: false
  });

  if (shouldSetupMobile) {
    await runMobileConfigWizard(env);
  } else {
    console.log('Mobile testing setup skipped.\n');
  }
}

async function validateSetup() {
  console.log('Step 8: Validation and Testing\n');
  console.log('Running system health checks...\n');

  const env = process.env.ENV || 'SIT';
  const configStatus = await checkConfigFiles(env);
  let allValid = true;

  if (configStatus.env) {
    console.log('✓ Environment configuration: VALID');
  } else {
    console.log('✗ Environment configuration: INVALID');
    allValid = false;
  }

  if (configStatus.db) {
    console.log('✓ Database configuration: VALID');
  } else {
    console.log('⚠ Database configuration: MISSING (optional)');
  }

  // Browser check
  const pw = await checkCommandVersion('npx', ['playwright', '--version']);
  if (pw.found) {
    console.log('✓ Browser installation: VALID');
  } else {
    console.log('✗ Browser installation: INVALID');
    allValid = false;
  }

  // Mobile prerequisites
  const appium = await checkCommandVersion('appium', ['--version']);
  if (appium.found) {
    console.log('✓ Appium: VALID');
  } else {
    console.log('⚠ Appium: NOT INSTALLED (run setup Step 6)');
  }

  const inspectorFound = fs.existsSync('/Applications/Appium Inspector.app');
  if (inspectorFound) {
    console.log('✓ Appium Inspector: VALID');
  } else {
    console.log('⚠ Appium Inspector: NOT INSTALLED');
  }

  if (!allValid) {
    console.log('\n⚠ Some validations failed. Review setup and re-run.');
  }

  console.log();
}

function showNextSteps() {
  console.log('Your environment is configured. Try these commands:');
  console.log('  • npm run qa:test web       # Run web tests');
  console.log('  • npm run qa:test api       # Run API tests');
  console.log('  • npm run qa:test mobile      # Run mobile tests');
  console.log('  • npm run qa:health all       # Check system health');
  console.log('  • npm run qa:report web       # Generate web reports');
  console.log('\nQuick reference: packages/qa-cli/README.md\n');
}

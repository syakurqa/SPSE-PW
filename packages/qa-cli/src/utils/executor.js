/* eslint-disable no-console */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { globSync } from 'glob';
/**
 * Execute npm/npx script from repository root
 * @param {string} script - Script to execute (e.g., 'run test:api' or 'npx playwright install')
 * @param {object} options - Execution options
 * @returns {Promise<{success: boolean, code: number}>}
 */
export async function executeNpmScript(script, options = {}) {
  let args = script.split(' ');

  // Detect if the command should be 'npx' or 'npm'
  let command = args[0] === 'npx' ? 'npx' : 'npm';

  // If the user included 'npx' in the string, remove it from the arguments list
  if (args[0] === 'npx') {
    args.shift();
  }

  // Prepend sudo when requested (for EACCES fallback on global installs)
  if (options.useSudo) {
    args = [command, ...args];
    command = 'sudo';
  }

  // When npm runs a script (npm run), it sets npm_config_* env vars from .npmrc.
  // Passing these through to a child npm install causes EALLOWSCRIPTS errors in
  // npm 11+ for workspace projects (the env-var form is treated like a CLI flag).
  // Filter them out so the child reads .npmrc / package.json directly.
  const { npm_config_allow_scripts: _, ...cleanEnv } = process.env;

  // Clean up sudo-related env — sudo clears these anyway but be explicit
  if (options.useSudo) {
    delete cleanEnv.PATH;
  }

  return new Promise((resolve, reject) => {
    const childProc = spawn(command, args, {
      cwd: getRepoRoot(),
      stdio: 'inherit',
      env: {
        ...cleanEnv,
        ...options.env
      }
    });

    childProc.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          code
        });
      } else {
        resolve({
          success: false,
          code
        });
      }
    });

    childProc.on('error', reject);
  });
}

/**
 * Run API tests
 * @param {object} options - Test options
 * @returns {Promise<{success: boolean, code: number}>}
 */
export async function runApiTests(options = {}) {
  if (options.env) {
    process.env.ENV = options.env;
  }
  return runPlaywrightTests('packages/api-automation', options);
}

/**
 * Run web tests
 * @param {object} options - Test options
 * @returns {Promise<{success: boolean, code: number}>}
 */
export async function runWebTests(options = {}) {
  if (options.env) {
    process.env.ENV = options.env;
  }
  return runPlaywrightTests('packages/web-automation', options);
}

/**
 * Run Playwright tests directly (bypasses npm scripts so CLI flags reach Playwright)
 * @param {string} packageDir - Package directory relative to repo root
 * @param {object} options - Test options
 * @returns {Promise<{success: boolean, code: number}>}
 */
function runPlaywrightTests(packageDir, options) {
  const repoRoot = getRepoRoot();
  const cwd = path.join(repoRoot, packageDir);
  const args = ['playwright', 'test'];

  if (options.headed) args.push('--headed');
  if (options.ui) args.push('--ui');
  if (options.tag) args.push('--grep', options.tag);
  if (options.grep && !options.tag) args.push('--grep', options.grep);
  if (options.file) {
    // Expand globs — spawn doesn't use a shell so **/* isn't expanded
    const repoRelative = path.resolve(repoRoot, options.file);
    const expanded = globSync(repoRelative, { nodir: true });
    if (expanded.length > 0) {
      expanded.forEach(f => args.push(path.relative(cwd, f)));
    } else {
      args.push(options.file);
    }
  }

  const env = {
    ...process.env,
    NODE_OPTIONS: `--loader ${path.join(repoRoot, 'alias-loader.mjs')} --no-warnings`
  };

  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      cwd,
      stdio: 'inherit',
      env
    });
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        code
      });
    });
    child.on('error', reject);
  });
}

/**
 * Run mobile tests
 * @param {object} options - Mobile test options
 * @returns {Promise<{success: boolean, code: number}>}
 */
export async function runMobileTests(options = {}) {
  const args = ['run', 'test:mobile'];

  // Set mobile-specific env vars
  if (options.deviceType) {
    process.env.DEVICE_TYPE = options.deviceType;
  }
  if (options.squad) {
    process.env.SQUAD = options.squad;
  }
  if (options.specPattern) {
    process.env.SPEC_PATTERN = options.specPattern;
  }
  if (options.appPath) {
    process.env.APP = options.appPath;
  }
  if (options.runType) {
    process.env.RUN_TYPE = options.runType;
  }
  if (options.env) {
    process.env.ENV = options.env;
  }
  if (options.tag) {
    process.env.TAG = options.tag;
  } else if (options.grep) {
    process.env.TAG = options.grep;
  }

  return executeNpmScript(args.join(' '));
}

/**
 * Check if a command is available and return its version
 * @param {string} command - Command to check (e.g., 'appium', 'java')
 * @param {string[]} args - Arguments (e.g., ['--version'])
 * @returns {Promise<{found: boolean, version: string}>}
 */
export function checkCommandVersion(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        found: code === 0 && output.trim().length > 0,
        version: output.trim().split('\n')[0]
      });
    });

    child.on('error', () => {
      resolve({
        found: false,
        version: ''
      });
    });
  });
}

/**
 * Generate test report
 * @param {string} type - Report type (api/web/mobile)
 * @returns {Promise<{success: boolean, code: number}>}
 */
export function generateReport(type) {
  const repoRoot = getRepoRoot();

  if (type === 'mobile') {
    return openMobileReport(repoRoot);
  }

  const reportBase = path.join(repoRoot, 'packages', `${type}-automation`, 'playwright-report');

  // Find latest timestamped report directory
  let reportPath = reportBase;
  try {
    const entries = fs.readdirSync(reportBase);
    const timestamps = entries.filter(e => {
      const full = path.join(reportBase, e);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'html', 'index.html'));
    }).sort().reverse();
    if (timestamps.length > 0) {
      reportPath = path.join(reportBase, timestamps[0], 'html');
    }
  } catch {
    // fall through with base path
  }

  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['playwright', 'show-report', reportPath], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        code
      });
    });
    child.on('error', reject);
  });
}

/**
 * Open mobile Mochawesome HTML report in browser
 * @param {string} repoRoot - Repository root path
 * @returns {Promise<{success: boolean, code: number}>}
 */
async function openMobileReport(repoRoot) {
  const resultsDir = path.join(repoRoot, 'packages/mobile-automation/reports');
  const reportDir = path.join(repoRoot, 'packages/mobile-automation/reports');
  const reportFile = path.join(reportDir, 'mochawesome-report.html');

  // If HTML report doesn't exist, try to generate from results
  if (!fs.existsSync(reportFile)) {
    if (!fs.existsSync(resultsDir) || fs.readdirSync(resultsDir).length === 0) {
      console.log('✗ No mobile report results found.');
      console.log('  Run mobile tests first: npm run qa:test mobile\n');
      return {
        success: false,
        code: 1
      };
    }

    try {
      const { execSync } = await import('child_process');
      // Merge mochawesome JSON files
      const jsonFiles = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json') && f !== 'merged.json');
      if (jsonFiles.length === 0) {
        console.log('✗ No Mochawesome JSON files found.');
        return {
          success: false,
          code: 1
        };
      }
      const merged = {
        stats: {},
        results: []
      };
      for (const file of jsonFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf-8'));
        merged.stats = data.stats || merged.stats;
        merged.results.push(...(data.results || []));
      }
      const mergedFile = path.join(resultsDir, 'merged.json');
      fs.writeFileSync(mergedFile, JSON.stringify(merged, null, 2));

      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      console.log('Generating Mochawesome HTML report...');
      execSync(`npx marge ${mergedFile} --reportDir ${reportDir}`, { stdio: 'inherit' });
    } catch (err) {
      console.log(`✗ Failed to generate report: ${err.message}`);
      return {
        success: false,
        code: 1
      };
    }
  }

  // Open in browser (static HTML, no CORS issues)
  try {
    const { execSync } = await import('child_process');
    const platform = process.platform;
    const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${openCmd} ${reportFile}`, { stdio: 'ignore' });
    console.log(`Mochawesome report opened: ${reportFile}`);
    return {
      success: true,
      code: 0
    };
  } catch {
    // Fallback: just show the path
    console.log(`Mochawesome report: file://${reportFile}`);
    return {
      success: true,
      code: 0
    };
  }
}

/**
 * Get repository root directory
 * @returns {string} - Absolute path to repo root
 */
export function getRepoRoot() {
  // Start from current directory and go up until we find package.json with workspaces
  let currentDir = process.cwd();

  while (currentDir !== '/') {
    const packageJsonPath = path.join(currentDir, 'package.json');

    try {
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf-8')
      );

      if (packageJson.workspaces) {
        return currentDir;
      }
    } catch (error) {
      // Continue searching up
    }

    currentDir = path.dirname(currentDir);
  }

  throw new Error('Could not find repository root. Are you in the monorepo?');
}

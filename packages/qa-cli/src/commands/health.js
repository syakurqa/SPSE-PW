/* eslint-disable no-console */
import { Command } from 'commander';
import { executeNpmScript } from '../utils/executor.js';

export function runHealthCommand(program) {
  const healthCommand = new Command('health')
    .description('Check system health and connectivity')
    .argument('[check]', 'Health check: all, env, connection, browser, testcases, mcp')
    .option('--fix', 'Attempt to fix issues automatically')
    .option('--verbose', 'Show detailed output')
    .action(async (check, options) => {
      if (!check || check === 'all') {
        await runAllHealthChecks(options);
      } else if (check === 'env') {
        await checkEnvHealth(options);
      } else if (check === 'connection') {
        await checkConnectionHealth(options);
      } else if (check === 'browser') {
        await checkBrowserHealth(options);
      } else if (check === 'testcases') {
        await checkTestcaseHealth(options);
      } else if (check === 'mcp') {
        await checkMcpHealth(options);
      } else {
        console.log('Usage: npm run qa:health [check] [options]');
        console.log('Health checks:');
        console.log('  all         - Run all health checks');
        console.log('  env         - Check environment configuration');
        console.log('  connection  - Check database and API connectivity');
        console.log('  browser     - Check browser installation');
        console.log('  testcases   - Check test case validation');
        console.log('  mcp         - Check MCP server connectivity');
        console.log('\nOptions:');
        console.log('  --fix       - Attempt to fix issues automatically');
        console.log('  --verbose   - Show detailed output');
      }
    });

  program.addCommand(healthCommand);
}

export async function runAllHealthChecks(options) {
  console.log('\n🔍 Running all health checks...\n');

  let allPassed = true;

  // Environment check
  console.log('1/5: Environment configuration');
  const envResult = await executeNpmScript('run check:env');
  if (envResult.success) {
    console.log('  ✓ Environment configuration: VALID\n');
  } else {
    console.log('  ✗ Environment configuration: INVALID\n');
    allPassed = false;
  }

  // Connection check
  console.log('2/5: Database and API connectivity');
  const connResult = await executeNpmScript('run check:connection');
  if (connResult.success) {
    console.log('  ✓ Database connectivity: VALID\n');
  } else {
    console.log('  ✗ Database connectivity: INVALID\n');
    allPassed = false;
  }

  // Browser check (basic Playwright check)
  console.log('3/5: Playwright browser installation');
  try {
    const { spawn } = await import('child_process');
    const browserCheck = spawn('npx', ['playwright', '--version'], {
      stdio: 'pipe'
    });

    await new Promise((resolve, reject) => {
      browserCheck.on('close', code => {
        if (code === 0) {
          console.log('  ✓ Browser installation: VALID\n');
          resolve(true);
        } else {
          console.log('  ✗ Browser installation: INVALID\n');
          allPassed = false;
          resolve(false);
        }
      });
      browserCheck.on('error', reject);
    });
  } catch (error) {
    console.log('  ✗ Browser installation: INVALID\n');
    allPassed = false;
  }

  // Test case check
  console.log('4/5: Test case references');
  const tcResult = await executeNpmScript('run check:testcase -- --all');
  if (tcResult.success) {
    console.log('  ✓ Test case references: VALID\n');
  } else {
    console.log('  ✗ Test case references: INVALID\n');
    allPassed = false;
  }

  // Unique test case check
  console.log('5/5: Duplicate test case IDs');
  const uniqueResult = await executeNpmScript('run check:unique-testcase -- --all');
  if (uniqueResult.success) {
    console.log('  ✓ Test case uniqueness: VALID\n');
  } else {
    console.log('  ✗ Test case uniqueness: INVALID\n');
    allPassed = false;
  }

  if (allPassed) {
    console.log('🎉 All health checks passed!');
  } else {
    console.log('⚠ Some health checks failed. Run with --verbose for details.');
  }

  process.exit(allPassed ? 0 : 1);
}

export async function checkEnvHealth(options) {
  console.log('\n🔍 Checking environment configuration...\n');

  const result = await executeNpmScript('run check:env');

  if (result.success) {
    console.log('✓ Environment configuration is valid');
    process.exit(0);
  } else {
    console.log('✗ Environment configuration is invalid');
    console.log('  Run: npm run qa:setup');
    process.exit(1);
  }
}

export async function checkConnectionHealth(options) {
  console.log('\n🔍 Checking database and API connectivity...\n');

  const result = await executeNpmScript('run check:connection');

  if (result.success) {
    console.log('✓ Database connectivity is valid');
    process.exit(0);
  } else {
    console.log('✗ Database connectivity is invalid');
    console.log('  Check: npm run qa:config validate');
    process.exit(1);
  }
}

export async function checkBrowserHealth(options) {
  console.log('\n🔍 Checking Playwright browser installation...\n');

  try {
    const { spawn } = await import('child_process');
    const browserCheck = spawn('npx', ['playwright', '--version'], {
      stdio: 'inherit'
    });

    await new Promise((resolve, reject) => {
      browserCheck.on('close', code => {
        if (code === 0) {
          console.log('✓ Browser installation is valid');
          resolve(true);
        } else {
          console.log('✗ Browser installation is invalid');
          console.log('  Run: npx playwright install chromium');
          resolve(false);
        }
      });
      browserCheck.on('error', reject);
    });

    process.exit(0);
  } catch (error) {
    console.log('✗ Browser installation check failed');
    console.log('  Run: npx playwright install chromium');
    process.exit(1);
  }
}

export async function checkTestcaseHealth(options) {
  console.log('\n🔍 Checking test case references...\n');

  const result = await executeNpmScript('run check:testcase');

  if (result.success) {
    console.log('✓ Test case references are valid');
    process.exit(0);
  } else {
    console.log('✗ Test case references are invalid');
    console.log('  Review test files and fix references');
    process.exit(1);
  }
}

async function checkMcpHealth(options) {
  console.log('\n🔍 Checking MCP server connectivity...\n');

  console.log('⚠ MCP server health check not implemented yet');
  console.log('  This requires MCP server configuration');
  console.log('  Configure with: npm run qa:setup');
  process.exit(0);
}
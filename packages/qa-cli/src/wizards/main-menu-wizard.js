/* eslint-disable no-console */
import { select, confirm } from '@inquirer/prompts';
import { runSetupWizard } from './setup-wizard.js';
import { runTestWizard } from './test-wizard.js';
import { runAgentSetupWizard } from './agent-setup-wizard.js';
import { runAgentChatWizard } from './agent-chat-wizard.js';
import { generateReport, executeNpmScript } from '../utils/executor.js';
import { showConfig, showMobileConfig } from '../commands/config.js';

export async function runMainMenu() {
  console.log('\n🎯 QA CLI');
  console.log('═══════════════════════════════════════════════════\n');

  while (true) {
    try {
      const choice = await select({
        message: 'What would you like to do?',
        choices: [
          {
            name: '🤖 AI Agent Setup',
            value: 'agent-setup',
            description: 'Configure Claude, MCP, and AI agents'
          },
          {
            name: '💬 Agent Chat',
            value: 'agent-chat',
            description: 'Pick an AI agent and describe your task'
          },
          {
            name: '🚀 Setup',
            value: 'setup',
            description: 'Interactive setup wizard'
          },
          {
            name: '🧪 Test',
            value: 'test',
            description: 'Run tests interactively'
          },
          {
            name: '📊 Reporting',
            value: 'report',
            description: 'View and manage reports'
          },
          {
            name: '💻 Codegen',
            value: 'codegen',
            description: 'Generate test code with Playwright'
          },
          {
            name: '🔍 Health Check',
            value: 'health',
            description: 'Check system health'
          },
          {
            name: '⚙️  Configuration',
            value: 'config',
            description: 'View current settings'
          },
          {
            name: '🚪 Exit',
            value: 'exit',
            description: 'Exit the CLI'
          }
        ]
      });

      if (choice === 'exit') {
        console.log('\nGoodbye! 👋\n');
        process.exit(0);
      }

      try {
        await handleChoice(choice);
      } catch (error) {
        if (error.name === 'ExitPromptError') {
          console.log('\nGoodbye! 👋\n');
          process.exit(0);
        }
        console.error(`\n❌ ${error.message}\n`);
      }
    } catch (error) {
      if (error.name === 'ExitPromptError') {
        console.log('\nGoodbye! 👋\n');
        process.exit(0);
      }
      throw error;
    }
  }
}

async function handleChoice(choice) {
  switch (choice) {
  case 'agent-setup':
    await runAgentSetupWizard();
    break;
  case 'agent-chat':
    await runAgentChatWizard();
    break;
  case 'setup':
    await runSetupWizard();
    break;
  case 'test':
    await runTestWizard();
    break;
  case 'report':
    await handleReport();
    break;
  case 'codegen':
    await handleCodegen();
    break;
  case 'health':
    await handleHealth();
    break;
  case 'config':
    await handleConfig();
    break;
  }
}

async function handleReport() {
  const choice = await select({
    message: 'Select report type:',
    choices: [
      {
        name: '📊 API Reports',
        value: 'api'
      },
      {
        name: '🌐 Web Reports',
        value: 'web'
      },
      {
        name: '📱 Mobile Reports',
        value: 'mobile'
      },
      {
        name: '← Back',
        value: 'back'
      }
    ]
  });

  if (choice === 'back') return;

  console.log(`\nOpening ${choice.toUpperCase()} report...`);
  const result = await generateReport(choice);
  if (result.success) {
    console.log('✓ Report generated successfully\n');
  } else {
    console.error('✗ Report generation failed\n');
  }
}

async function handleCodegen() {
  const shouldRun = await confirm({
    message: 'Launch Playwright code generator?',
    default: true
  });

  if (shouldRun) {
    console.log('\nStarting Playwright code generator...\n');
    await executeNpmScript('run codegen:web');
    console.log('');
  }
}

async function handleHealth() {
  const choice = await select({
    message: 'Select health check:',
    choices: [
      {
        name: '🔍 Run All Checks',
        value: 'all'
      },
      {
        name: '📋 Environment Config',
        value: 'env'
      },
      {
        name: '🔗 Database/API Connectivity',
        value: 'connection'
      },
      {
        name: '🌐 Browser Installation',
        value: 'browser'
      },
      {
        name: '📝 Test Case References',
        value: 'testcases'
      },
      {
        name: '← Back',
        value: 'back'
      }
    ]
  });

  if (choice === 'back') return;

  console.log('');

  if (choice === 'all') {
    await runAllChecks();
  } else {
    await runSingleCheck(choice);
  }

  console.log('');
}

async function runAllChecks() {
  const checks = [
    {
      label: 'Environment configuration',
      script: 'run check:env'
    },
    {
      label: 'Database and API connectivity',
      script: 'run check:connection'
    },
    {
      label: 'Test case references',
      script: 'run check:testcase'
    },
    {
      label: 'Duplicate test case IDs',
      script: 'run check:unique-testcase'
    }
  ];

  let allPassed = true;

  for (const [i, check] of checks.entries()) {
    console.log(`${i + 1}/${checks.length + 1}: ${check.label}`);

    if (check.script === 'run check:testcase') {
      const ok = await runTestCaseCheck();
      if (!ok) allPassed = false;
    } else {
      const result = await executeNpmScript(check.script);
      if (result.success) {
        console.log(`  ✓ ${check.label}: VALID\n`);
      } else {
        console.log(`  ✗ ${check.label}: INVALID\n`);
        allPassed = false;
      }
    }
  }

  // Browser check
  console.log(`${checks.length + 1}/${checks.length + 1}: Browser installation`);
  try {
    const { spawn } = await import('child_process');
    const browserCheck = spawn('npx', ['playwright', '--version'], { stdio: 'pipe' });
    await new Promise((resolve, reject) => {
      browserCheck.on('close', code => {
        if (code === 0) {
          console.log('  ✓ Browser installation: VALID\n');
          resolve();
        } else {
          console.log('  ✗ Browser installation: INVALID\n');
          allPassed = false;
          resolve();
        }
      });
      browserCheck.on('error', reject);
    });
  } catch {
    console.log('  ✗ Browser installation: INVALID\n');
    allPassed = false;
  }

  if (allPassed) {
    console.log('🎉 All health checks passed!');
  } else {
    console.log('⚠ Some health checks failed. Run individual checks for details.');
  }
}

async function runTestCaseCheck() {
  // Count first — no API calls
  const countResult = await executeNpmScript('run check:testcase -- --count-only');
  if (!countResult.success) {
    console.log('  ✗ Failed to scan test cases\n');
    return false;
  }

  const proceed = await confirm({
    message: 'Validate these test cases against Zephyr? This may take a few minutes.',
    default: true
  });
  if (!proceed) {
    console.log('  Skipped test case validation.\n');
    return true;
  }

  const result = await executeNpmScript('run check:testcase -- --all');
  if (result.success) {
    console.log('  ✓ Test case references: VALID\n');
    return true;
  }
  console.log('  ✗ Test case references: INVALID\n');
  return false;

}

async function runSingleCheck(choice) {
  const checks = {
    env: {
      label: 'Environment configuration',
      script: 'run check:env'
    },
    connection: {
      label: 'Database connectivity',
      script: 'run check:connection'
    },
    testcases: {
      label: 'Test case references',
      script: 'run check:testcase -- --all'
    }
  };

  if (choice === 'testcases') {
    await runTestCaseCheck();
    return;
  }

  if (choice === 'browser') {
    console.log('Checking browser installation...');
    try {
      const { spawn } = await import('child_process');
      const browserCheck = spawn('npx', ['playwright', '--version'], { stdio: 'inherit' });
      await new Promise((resolve, reject) => {
        browserCheck.on('close', code => {
          if (code === 0) {
            console.log('✓ Browser installation is valid');
          } else {
            console.log('✗ Browser installation is invalid');
            console.log('  Run: npx playwright install chromium');
          }
          resolve();
        });
        browserCheck.on('error', reject);
      });
    } catch {
      console.log('✗ Browser check failed');
    }
    return;
  }

  const check = checks[choice];
  if (check) {
    console.log(`Checking ${check.label.toLowerCase()}...`);
    const result = await executeNpmScript(check.script);
    if (result.success) {
      console.log(`✓ ${check.label} is valid`);
    } else {
      console.log(`✗ ${check.label} is invalid`);
    }
  }
}

async function handleConfig() {
  const choice = await select({
    message: 'What configuration do you want to view?',
    choices: [
      {
        name: '🌍 Environment & Database',
        value: 'env'
      },
      {
        name: '📱 Mobile Configuration',
        value: 'mobile'
      },
      {
        name: '← Back',
        value: 'back'
      }
    ]
  });

  if (choice === 'back') return;

  const env = process.env.ENV || 'SIT';
  console.log('');

  if (choice === 'mobile') {
    await showMobileConfig();
  } else {
    await showConfig(env);
  }

  console.log('');
}

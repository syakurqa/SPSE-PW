/* eslint-disable no-console */
import { input, confirm } from '@inquirer/prompts';
import { getRepoRoot } from '../utils/executor.js';

export async function runAgentChatWizard() {
  console.log('\n💬 Agent Chat');
  console.log('═════════════════════════════════════════════════════════\n');
  console.log('Describe your task. The wizard agent will route it to the right specialist.\n');
  console.log('Type "exit" to stop.\n');

  while (true) {
    try {
      const userPrompt = await input({
        message: '> wizard',
        validate: (val) => {
          if (val.trim().length === 0) return 'Please describe what you need, or type "exit" to stop';
          return true;
        }
      });

      if (userPrompt.trim().toLowerCase() === 'exit') {
        console.log('');
        return;
      }

      const launch = await confirm({
        message: 'Launch Claude Code with wizard agent?',
        default: true
      });

      if (launch) {
        await launchClaudeCode(userPrompt.trim());
        return;
      }

      console.log('\nRun manually:');
      console.log(`  claude "@.github/agents/wizard.agent.md ${userPrompt.trim()}"\n`);

    } catch (error) {
      if (error.name === 'ExitPromptError') {
        console.log('\n');
        return;
      }
      console.error(`\n❌ ${error.message}\n`);
    }
  }
}

async function launchClaudeCode(prompt) {
  console.log('\nLaunching Claude Code with wizard agent...\n');

  // ponytail: @ agent file loads it as context — GitHub Copilot agents aren't native Claude Code agents
  const fullPrompt = `@.github/agents/wizard.agent.md ${prompt}`;

  const { spawn } = await import('child_process');
  const child = spawn('claude', [fullPrompt], {
    stdio: 'inherit',
    cwd: getRepoRoot()
  });

  return new Promise((resolve) => {
    child.on('close', () => {
      console.log('\n👋 Claude closed. Returning to main menu...\n');
      resolve();
    });
    child.on('error', () => {
      console.log('\n⚠ Claude CLI not found.');
      console.log('  Install it first: npm install -g @anthropic-ai/claude-code');
      console.log('  Or run: npm run qa → 🤖 AI Agent Setup (includes CLI install)');
      console.log('\n  Then run manually:');
      console.log('  claude "@.github/agents/wizard.agent.md ' + prompt + '"\n');
      resolve();
    });
  });
}

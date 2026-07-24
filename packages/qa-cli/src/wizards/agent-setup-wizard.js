/* eslint-disable no-console */
import {
  select, confirm, input, password
} from '@inquirer/prompts';
import { executeNpmScript, getRepoRoot } from '../utils/executor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

const DEEPSEEK_TEMPLATE = {
  env: {
    ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_MODEL: 'deepseek-v4-pro[1m]',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro[1m]',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-v4-pro[1m]',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-v4-flash[1m]',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_EFFORT_LEVEL: 'max'
  },
  model: 'ark-code-latest',
  effortLevel: 'high',
  skipAutoPermissionPrompt: true
};

export async function runAgentSetupWizard() {
  console.log('\n🤖 AI Agent Setup Wizard');
  console.log('═════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Provider preference
    const providerChoice = await askProviderPreference();

    // Step 2: Claude config
    await checkClaudeConfig(providerChoice);

    // Step 3: Claude CLI installation
    await checkClaudeCli();

    // Step 4: MCP config
    await checkMcpConfig();

    // Step 5: Clone and build jira-zephyr-mcp
    await cloneAndBuildJiraZephyrMcp();

    // Step 6: Verification
    await verifySetup(providerChoice);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎉 AI Agent Setup Complete!\n');

    showNextSteps();
  } catch (error) {
    console.error(`\n❌ AI agent setup failed: ${error.message}`);
    throw error;
  }
}

// --- Step 1: Provider preference ---

async function askProviderPreference() {
  console.log('Step 1: LLM Provider Configuration\n');

  const choice = await select({
    message: 'Do you want to use the team\'s shared LLM configuration or bring your own?',
    choices: [
      {
        name: 'Use team config (DeepSeek)',
        value: 'deepseek',
        description: 'deepseek-v4-pro[1m] via api.deepseek.com — recommended for the team'
      },
      {
        name: 'Bring my own',
        value: 'custom',
        description: 'Use your own LLM provider and model'
      }
    ]
  });

  if (choice === 'deepseek') {
    console.log('\nUsing team DeepSeek configuration.');
    console.log('  Provider: DeepSeek (api.deepseek.com/anthropic)');
    console.log('  Model:    deepseek-v4-pro[1m]\n');

    const key = await password({
      message: 'Enter the shared DeepSeek API key:',
      validate: (val) => val.trim().length > 0 || 'API key is required'
    });

    return {
      type: 'deepseek',
      config: {
        ...DEEPSEEK_TEMPLATE,
        env: {
          ...DEEPSEEK_TEMPLATE.env,
          ANTHROPIC_AUTH_TOKEN: key.trim()
        }
      }
    };
  }

  // Custom provider
  console.log('\nConfigure your own LLM provider.\n');

  const baseUrl = await input({
    message: 'ANTHROPIC_BASE_URL (API endpoint):',
    default: 'https://api.anthropic.com',
    validate: (val) => val.trim().length > 0 || 'Base URL is required'
  });

  const model = await input({
    message: 'ANTHROPIC_MODEL (model name):',
    default: 'claude-sonnet-4-6',
    validate: (val) => val.trim().length > 0 || 'Model is required'
  });

  const authToken = await password({
    message: 'ANTHROPIC_AUTH_TOKEN (API key):',
    validate: (val) => val.trim().length > 0 || 'API key is required'
  });

  // Ask about haiku fallback model
  const haikuModel = await input({
    message: 'ANTHROPIC_DEFAULT_HAIKU_MODEL (fallback for cheap tasks):',
    default: 'claude-haiku-4-5-20251001'
  });

  return {
    type: 'custom',
    config: {
      env: {
        ANTHROPIC_BASE_URL: baseUrl.trim(),
        ANTHROPIC_AUTH_TOKEN: authToken.trim(),
        ANTHROPIC_MODEL: model.trim(),
        ANTHROPIC_DEFAULT_OPUS_MODEL: model.trim(),
        ANTHROPIC_DEFAULT_SONNET_MODEL: model.trim(),
        ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel.trim(),
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
      },
      skipAutoPermissionPrompt: true
    }
  };
}

// --- Step 2: Claude config ---

async function checkClaudeConfig(providerChoice) {
  console.log('Step 2: Claude Configuration\n');

  const dir = path.dirname(CLAUDE_SETTINGS_PATH);
  let existing = null;

  try {
    existing = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
  } catch {
    // file doesn't exist or isn't valid JSON
  }

  if (existing) {
    const currentModel = existing.env?.ANTHROPIC_MODEL || 'not set';
    const currentUrl = existing.env?.ANTHROPIC_BASE_URL || 'not set';
    const hasKey = !!existing.env?.ANTHROPIC_AUTH_TOKEN;

    console.log('Current configuration:');
    console.log(`  Provider URL: ${currentUrl}`);
    console.log(`  Model:        ${currentModel}`);
    console.log(`  API Key:      ${hasKey ? '***configured***' : 'MISSING'}\n`);

    // Check if it matches the target config
    const targetModel = providerChoice.config.env.ANTHROPIC_MODEL;
    const targetUrl = providerChoice.config.env.ANTHROPIC_BASE_URL;

    if (currentModel === targetModel && currentUrl === targetUrl && hasKey) {
      console.log('✓ Claude is already configured with the expected settings.\n');

      const update = await confirm({
        message: 'Update the configuration anyway?',
        default: false
      });
      if (!update) return;
    } else {
      const replace = await confirm({
        message: 'Configuration differs from expected. Update it?',
        default: true
      });
      if (!replace) {
        console.log('  Keeping existing configuration.\n');
        return;
      }
    }
  } else {
    console.log('No Claude configuration found.\n');
    // ponytail: only create dir when we actually need to write
  }

  // Write config
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const config = {
    ...existing || {},  // preserve any existing non-env fields
    ...providerChoice.config,
    env: {
      ...(existing?.env || {}),  // preserve any existing env vars
      ...providerChoice.config.env
    }
  };

  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(config, null, 2) + '\n');
  console.log(`✓ Claude configuration written to ${CLAUDE_SETTINGS_PATH}\n`);
}

// --- Step 3: Claude CLI ---

async function checkClaudeCli() {
  console.log('Step 3: Claude CLI Installation\n');

  // ponytail: check if claude is on PATH, offer to install if missing
  try {
    const { spawn } = await import('child_process');
    const found = await new Promise((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: 'pipe' });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });

    if (found) {
      console.log('✓ Claude CLI already installed\n');
      return;
    }
  } catch {
    // not found, continue to install
  }

  console.log('Claude CLI not found. Required for launching AI agents from the QA CLI.\n');

  const install = await confirm({
    message: 'Install Claude Code CLI globally? (npm install -g @anthropic-ai/claude-code)',
    default: true
  });

  if (install) {
    console.log('\nInstalling Claude Code CLI...');
    let result = await executeNpmScript('install -g @anthropic-ai/claude-code');

    if (result.success) {
      console.log('✓ Claude CLI installed successfully\n');
      return;
    }

    // EACCES — most common failure for global install, offer sudo fallback
    console.log('\n⚠ npm install failed. Likely a permission error:');
    console.log('  Your user does not own the global npm directory.\n');

    const useSudo = await confirm({
      message: 'Retry with sudo?',
      default: true
    });

    if (useSudo) {
      result = await executeNpmScript(
        'install -g @anthropic-ai/claude-code',
        { useSudo: true }
      );
      if (result.success) {
        console.log('✓ Claude CLI installed successfully via sudo\n');
        return;
      }
    }

    console.log('\nAlternative fix: configure npm to use your user directory (avoids sudo next time):\n');
    console.log('  mkdir -p ~/.npm-global');
    console.log('  npm config set prefix ~/.npm-global');
    console.log('  # Then add to ~/.zshrc:');
    console.log("  export PATH=~/.npm-global/bin:$PATH\n");
    console.log('\nOr install manually:');
    console.log('  npm install -g @anthropic-ai/claude-code\n');
  } else {
    console.log('Skipped. Install manually: npm install -g @anthropic-ai/claude-code\n');
  }
}

// --- Step 4: MCP config ---

async function checkMcpConfig() {
  console.log('Step 4: MCP Server Configuration\n');

  const repoRoot = getRepoRoot();
  const mcpPath = path.join(repoRoot, '.vscode', 'mcp.json');
  const jiraZephyrPath = '.github/agents/mcp-servers/jira-zephyr-mcp/dist/index.js';

  let existing = null;
  try {
    existing = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
  } catch {
    // file doesn't exist
  }

  const hasJiraZephyr = existing?.servers?.['jira-zephyr-mcp'];
  const hasAtlassian = existing?.servers?.atlassian;

  if (hasJiraZephyr && hasAtlassian) {
    const jzEnv = hasJiraZephyr.env || {};
    const hasCreds = jzEnv.JIRA_USERNAME && jzEnv.JIRA_API_TOKEN && jzEnv.ZEPHYR_API_TOKEN;
    console.log('Current MCP servers:');
    console.log(`  jira-zephyr-mcp: ${hasCreds ? '✓ configured' : '⚠ missing credentials'}`);
    console.log('  atlassian:       ✓ configured\n');

    if (hasCreds) {
      const update = await confirm({
        message: 'MCP is already configured. Update credentials?',
        default: false
      });
      if (!update) {
        console.log('  Keeping existing MCP configuration.\n');
        return;
      }
    }
  } else {
    console.log('MCP configuration missing or incomplete.\n');
    console.log('Reference: README.md — MCP Setup section (lines 146-181)\n');
  }

  // Gather credentials
  console.log('Enter your Jira and Zephyr credentials:\n');

  const jiraUsername = await input({
    message: 'JIRA_USERNAME (email):',
    default: existing?.servers?.['jira-zephyr-mcp']?.env?.JIRA_USERNAME || '',
    validate: (val) => val.trim().length > 0 || 'Email is required'
  });

  const jiraToken = await password({
    message: 'JIRA_API_TOKEN (from https://id.atlassian.com/manage-profile/security/api-tokens):',
    validate: (val) => val.trim().length > 0 || 'API token is required'
  });

  const zephyrToken = await password({
    message: 'ZEPHYR_API_TOKEN (from https://bfifinance.atlassian.net/plugins/servlet/ac/com.kanoah.test-manager/api-access-tokens):',
    validate: (val) => val.trim().length > 0 || 'API token is required'
  });

  const mcpConfig = {
    servers: {
      'jira-zephyr-mcp': {
        type: 'stdio',
        command: 'node',
        args: [jiraZephyrPath],
        env: {
          JIRA_BASE_URL: 'https://bfifinance.atlassian.net/',
          JIRA_USERNAME: jiraUsername.trim(),
          JIRA_API_TOKEN: jiraToken.trim(),
          ZEPHYR_API_TOKEN: zephyrToken.trim()
        }
      },
      atlassian: {
        type: 'http',
        url: 'https://mcp.atlassian.com/v1/mcp',
        gallery: 'https://api.mcp.github.com',
        version: '1.1.1'
      }
    },
    inputs: []
  };

  if (!fs.existsSync(path.dirname(mcpPath))) {
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
  }

  fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n');
  console.log(`\n✓ MCP configuration written to ${mcpPath}`);

  // Also write to Claude Code config so the CLI can use MCP servers
  writeClaudeCodeMcpConfig(mcpConfig);

  console.log('  Credentials are stored locally and never committed (gitignored).');
  console.log('\n⚠ The Atlassian MCP server requires login.');
  console.log('  Next time you start Claude Code, you will be prompted to authenticate.');
  console.log('  A browser window will open — log in with your Atlassian account.');
  console.log('  Account: https://bfifinance.atlassian.net\n');
}

// ponytail: write MCP config to Claude Code's config so CLI can use MCP servers
function writeClaudeCodeMcpConfig(mcpConfig) {
  const claudeConfigPath = path.join(os.homedir(), '.claude.json');
  const repoRoot = getRepoRoot();

  let claudeConfig = {};
  try {
    claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf-8'));
  } catch {
    // file doesn't exist or invalid, start fresh
  }

  // Ensure projects section exists
  if (!claudeConfig.projects) claudeConfig.projects = {};

  // Use repo path as key (match how Claude Code identifies the project)
  if (!claudeConfig.projects[repoRoot]) claudeConfig.projects[repoRoot] = {};
  claudeConfig.projects[repoRoot].mcpServers = mcpConfig.servers;

  fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2) + '\n');
  console.log(`✓ Claude Code MCP config written to ${claudeConfigPath}`);
}

// --- Step 5: Clone and build jira-zephyr-mcp ---

async function cloneAndBuildJiraZephyrMcp() {
  console.log('Step 5: Jira-Zephyr MCP Server\n');

  const repoRoot = getRepoRoot();
  const cloneDir = path.join(repoRoot, '.github', 'agents', 'mcp-servers', 'jira-zephyr-mcp');
  const distFile = path.join(cloneDir, 'dist', 'index.js');

  if (fs.existsSync(distFile)) {
    console.log(`✓ jira-zephyr-mcp already installed at ${path.relative(repoRoot, cloneDir)}\n`);

    const update = await select({
      message: 'What would you like to do?',
      choices: [
        {
          name: 'Skip (keep current version)',
          value: 'skip'
        },
        {
          name: 'Pull latest and rebuild',
          value: 'update'
        },
        {
          name: 'Re-clone from scratch',
          value: 'reclone'
        }
      ]
    });

    if (update === 'skip') return;

    if (update === 'update') {
      console.log('\nPulling latest changes...');
      const pullResult = await spawnInDir(cloneDir, 'git', ['pull']);
      if (!pullResult.success) {
        console.log('⚠ Git pull failed. Continuing with existing version.\n');
        return;
      }
      console.log('Installing dependencies...');
      await spawnInDir(cloneDir, 'npm', ['install']);
      console.log('Building...');
      await spawnInDir(cloneDir, 'npm', ['run', 'build']);
      console.log('✓ Updated and rebuilt.\n');
      return;
    }

    // Re-clone: remove old first
    console.log('Removing existing clone...');
    fs.rmSync(cloneDir, {
      recursive: true,
      force: true
    });
  }

  // Clone
  console.log('Cloning jira-zephyr-mcp from git@github.com:bfi-finance/jira-zephyr-mcp.git...\n');

  const parentDir = path.dirname(cloneDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const cloneResult = await spawnInDir(
    parentDir,
    'git',
    ['clone', 'git@github.com:bfi-finance/jira-zephyr-mcp.git', cloneDir]
  );

  if (!cloneResult.success) {
    console.log('\n⚠ Clone failed. You can clone manually:');
    console.log(`  git clone git@github.com:bfi-finance/jira-zephyr-mcp.git ${cloneDir}`);
    console.log(`  cd ${cloneDir} && npm install && npm run build\n`);
    return;
  }

  // Install and build
  console.log('Installing dependencies...');
  const installResult = await spawnInDir(cloneDir, 'npm', ['install']);
  if (!installResult.success) {
    console.log('⚠ npm install failed. Run manually:');
    console.log(`  cd ${cloneDir} && npm install && npm run build\n`);
    return;
  }

  console.log('Building...');
  const buildResult = await spawnInDir(cloneDir, 'npm', ['run', 'build']);
  if (!buildResult.success) {
    console.log('⚠ Build failed. Run manually:');
    console.log(`  cd ${cloneDir} && npm run build\n`);
    return;
  }

  if (fs.existsSync(distFile)) {
    console.log(`✓ jira-zephyr-mcp built successfully: ${path.relative(repoRoot, distFile)}\n`);
  } else {
    console.log(`⚠ Build completed but ${distFile} not found. Check the build output.\n`);
  }
}

// --- Step 5: Verification ---

async function verifySetup(providerChoice) {
  console.log('Step 6: Verification\n');

  let allPassed = true;
  const targetModel = providerChoice.config.env.ANTHROPIC_MODEL;
  const targetUrl = providerChoice.config.env.ANTHROPIC_BASE_URL;

  // Check Claude config
  try {
    const claudeConfig = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
    const modelOk = claudeConfig.env?.ANTHROPIC_MODEL === targetModel;
    const urlOk = claudeConfig.env?.ANTHROPIC_BASE_URL === targetUrl;
    const keyOk = !!claudeConfig.env?.ANTHROPIC_AUTH_TOKEN;

    if (modelOk && urlOk && keyOk) {
      console.log(`✓ Claude config: ${targetModel} @ ${targetUrl}`);
    } else {
      console.log('✗ Claude config: INCOMPLETE');
      if (!modelOk) console.log(`  Model mismatch: expected ${targetModel}, got ${claudeConfig.env?.ANTHROPIC_MODEL}`);
      if (!urlOk) console.log(`  URL mismatch: expected ${targetUrl}, got ${claudeConfig.env?.ANTHROPIC_BASE_URL}`);
      if (!keyOk) console.log('  API key not set');
      allPassed = false;
    }
  } catch {
    console.log('✗ Claude config: MISSING');
    allPassed = false;
  }

  // Check MCP config
  const repoRoot = getRepoRoot();
  const mcpPath = path.join(repoRoot, '.vscode', 'mcp.json');
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    const jzOk = !!mcpConfig.servers?.['jira-zephyr-mcp']?.env?.JIRA_API_TOKEN;
    const atlOk = !!mcpConfig.servers?.atlassian;
    if (jzOk && atlOk) {
      console.log('✓ MCP config: jira-zephyr-mcp + atlassian');
      console.log('  ⚠ Atlassian MCP requires login — restart VS Code and authenticate when prompted');
    } else {
      console.log('✗ MCP config: INCOMPLETE');
      if (!jzOk) console.log('  jira-zephyr-mcp missing or missing credentials');
      if (!atlOk) console.log('  atlassian server missing');
      allPassed = false;
    }
  } catch {
    console.log('✗ MCP config: MISSING');
    allPassed = false;
  }

  // Check jira-zephyr-mcp build
  const distFile = path.join(repoRoot, '.github', 'agents', 'mcp-servers', 'jira-zephyr-mcp', 'dist', 'index.js');
  if (fs.existsSync(distFile)) {
    console.log('✓ jira-zephyr-mcp: installed and built');
  } else {
    console.log('✗ jira-zephyr-mcp: missing — run Step 4 again');
    allPassed = false;
  }

  // Check Node.js
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace('v', '').split('.')[0]);
  if (major >= 20) {
    console.log(`✓ Node.js: ${nodeVersion}`);
  } else {
    console.log(`✗ Node.js: ${nodeVersion} (>= 20 required)`);
    allPassed = false;
  }

  // Check Claude CLI
  try {
    const { spawn } = await import('child_process');
    const claudeFound = await new Promise((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: 'pipe' });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
    if (claudeFound) {
      console.log('✓ Claude CLI: installed');
    } else {
      console.log('✗ Claude CLI: not found — run Step 3 again');
      allPassed = false;
    }
  } catch {
    console.log('✗ Claude CLI: not found — run Step 3 again');
    allPassed = false;
  }

  if (allPassed) {
    console.log('\n✓ All checks passed.\n');
  } else {
    console.log('\n⚠ Some checks failed. Re-run the wizard to fix issues.\n');
  }

  // Reminder
  console.log('⚠ Remember: Restart VS Code / Claude Code for MCP changes to take effect.\n');
}

// --- Next steps ---

function showNextSteps() {
  console.log('Your AI agent environment is ready!');
  console.log('\nAvailable agents in .github/agents/:');
  console.log('  • test-planner                — Create test plans from Jira/Confluence');
  console.log('  • api-automation-generator    — Generate API automation tests');
  console.log('  • ui-automation-generator     — Generate UI automation tests');
  console.log('  • api-exploratory-test        — Create exploratory API test plans');
  console.log('  • zephyr-test-case-converter  — Convert test cases to Zephyr');
  console.log('  • wizard                      — Return to this setup wizard');
  console.log('\nQuick start:');
  console.log('  • npm run qa                  — QA CLI main menu');
  console.log('  • npm run qa:test api         — Run API tests');
  console.log('  • npm run qa:test web         — Run web tests');
  console.log('  • npm run qa:health all       — Check system health');
  console.log();
}

// --- Utility: spawn a command in a directory ---

async function spawnInDir(cwd, command, args) {
  const { spawn } = await import('child_process');
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        code
      });
    });
    child.on('error', (err) => {
      console.error(`  Error: ${err.message}`);
      resolve({
        success: false,
        code: -1
      });
    });
  });
}

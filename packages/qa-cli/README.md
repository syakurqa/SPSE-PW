# QA CLI

Interactive CLI for QA automation testing in BFI Finance monorepo. Launches from the repo root:

```bash
npm run qa
```

## Interactive Menu

| Option | Description |
| --- | --- |
| 🤖 **AI Agent Setup** | Configure Claude Code, MCP servers, and AI agents for test automation |
| 💬 **Agent Chat** | Chat with AI agents — describe a task and an agent handles it (test plans, test generation, Zephyr upload) |
| 🚀 **Setup** | Interactive setup wizard — configure environments, install deps, set up browsers |
| 🧪 **Test** | Run tests interactively — select type (api/web/mobile), env, browser mode, filters |
| 📊 **Reporting** | View API, web, or mobile reports |
| 💻 **Codegen** | Launch Playwright code generator for recording UI tests |
| 🔍 **Health Check** | Run all or individual health checks (env, DB, browser, test cases) |
| ⚙️ **Configuration** | View current environment and database settings |

## Direct Subcommands

For scripting and CI, bypass the interactive menu:

```bash
npm run qa test api              # Run API tests directly
npm run qa test web -- --headed  # Run web tests headed
npm run qa setup                 # Run setup directly
npm run qa health all            # Run all health checks
npm run qa report api            # Open API report
npm run qa report mobile         # Open mobile report
```

### Test Options

```bash
npm run qa test api --tag @PLAT-T2794    # Filter by tag
npm run qa test web --headed --env UAT   # Headed, UAT environment
npm run qa test api --file path/to/test.spec.js  # Single file
```

### Report Options

```bash
npm run qa report api       # Open latest Playwright HTML report
npm run qa report web       # Open latest Playwright HTML report
npm run qa report mobile    # Open mochawesome HTML report in browser
```

## AI Agent Setup Wizard

Configures Claude Code and MCP servers so AI agents can interact with Jira, Zephyr, and Confluence directly from the repo. Runs 6 steps:

| Step | What it does |
| --- | --- |
| 1. LLM Provider | Choose team DeepSeek config or bring-your-own (Anthropic, etc.). Prompts for API key. |
| 2. Claude Config | Write provider URL, auth token, and model to `~/.claude/settings.json`. |
| 3. Claude CLI | Check for `claude` on PATH. Offer to install via `npm install -g @anthropic-ai/claude-code`. |
| 4. MCP Servers | Configure `jira-zephyr-mcp` (Zephyr Scale) and `atlassian` (Jira/Confluence) MCP servers in `.vscode/mcp.json` and `~/.claude.json`. |
| 5. jira-zephyr-mcp | Clone, install, and build the Jira-Zephyr MCP server from `github.com:bfi-finance/jira-zephyr-mcp`. |
| 6. Verification | Check all items: Claude config, MCP config, jira-zephyr-mcp build, Node >= 20, Claude CLI. |

## Agent Chat

The **Agent Chat** launches a REPL where you describe a task in plain language. It delegates to a router agent that picks the right specialist:

| Agent | What it does |
| --- | --- |
| **Test Planner** | Reads Jira stories / Confluence pages and creates structured test plans |
| **API Automation Generator** | Generates API test specs and service wrappers following project conventions |
| **UI Automation Generator** | Generates Playwright UI tests with page object models |
| **API Exploratory Test** | Creates exploratory API test plans and test data |
| **Zephyr Test Case Converter** | Converts test cases to Zephyr Scale format and uploads them |

Agent files live in `.github/agents/` at the repo root. Shared docs, templates, and format references are under `.github/agents/shared/`, `.github/agents/docs/`, and `.github/agents/templates/`.

## Setup Wizard Steps

The setup wizard runs through these steps in order:

| Step | What it does |
| --- | --- |
| 1. Environment Selection | Pick SIT, UAT, or both |
| 2. Prerequisites Check | Verify Git is installed |
| 3. Dependencies | Install npm workspace dependencies (api, web, mobile) |
| 4. Browsers | Check for Chromium, install if missing |
| 5. Config Files | Check `env.{env}.json`, `db.{env}.json`, `mobile.env.{env}.json` exist |
| 6. Mobile Prerequisites | Check Java, ANDROID_HOME, Appium, Appium drivers, Appium Inspector |
| 7. Mobile Setup | Auto-populate `.env` from mobile config file |
| 8. Validation | Verify config files, Playwright, Appium, Appium Inspector |

**Step 5 blocks continuation** — if config files are missing, the wizard stops and shows which files to create.

## Manual Configuration (not covered by wizard)

The wizard checks for these but does **not** create them. You must set them up manually.

### Config Files

Create these JSON files under `packages/common-module/config/`:

**`env.{env}.json`** (e.g. `env.sit.json`, `env.uat.json`):
```json
{
  "apiUrl": "https://api.sit.example.com",
  "apiVersion": "v2.1",
  "authUrl": "https://auth.sit.example.com",
  "timeout": 30000,
  "retryCount": 2,
  "additionalHeaders": {}
}
```

**`db.{env}.json`** (e.g. `db.sit.json`, `db.uat.json`):
```json
{
  "client": "pg",
  "connection": {
    "host": "db.sit.example.com",
    "port": 5432,
    "database": "bfi_automation_sit",
    "user": "automation_user",
    "password": "",
    "ssl": false
  },
  "pool": { "min": 2, "max": 10 }
}
```

**`mobile.env.{env}.json`** (e.g. `mobile.env.sit.json`, `mobile.env.uat.json`):
```json
{
  "appiumServer": "http://localhost:4723/wd/hub",
  "deviceType": "android",
  "appPath": "/path/to/app.apk",
  "appiumCapabilities": {},
  "timeout": 60000
}
```

Get real values from the team Google Sheet. See root `README.md` for links.

### System Dependencies

| Tool | Required for | Install |
| --- | --- | --- |
| Node.js >= 20 | All packages | `nvm install 20` |
| Git | Prerequisite check | `brew install git` |
| Java JDK 11+ | Appium / Android | `brew install openjdk@11` |
| Appium 2.x | Local mobile testing | `npm install -g appium` |
| Appium drivers | Local mobile testing | `appium driver install uiautomator2` (Android) / `appium driver install xcuitest` (iOS) |
| Appium Inspector | Element inspection | [Download from GitHub](https://github.com/appium/appium-inspector/releases) |
| Android SDK | Android testing | Android Studio (set `ANDROID_HOME`) |
| Xcode | iOS testing (macOS) | App Store + Command Line Tools |

### Mobile `.env` File

After config files are present, the wizard auto-creates `.env` at the repo root. To customize:

```bash
DEVICE_TYPE=android        # or ios
RUN_TYPE=LOCAL             # LOCAL, LAMBDA, or DEVICE-FARM
SQUAD=BFI_MOBILE           # LMS, PBF, AQM, BACKOFFICE, CUSTOMER, SURVEYOR, SUPPLIER
SPEC_PATTERN=bfi-mobile/tests/**/*.spec.js
APP=/path/to/app.apk       # empty for cloud services
```

## Directory Structure

```
packages/qa-cli/
├── src/
│   ├── index.js              # Entry point
│   ├── commands/             # Commander subcommand registrations
│   │   ├── setup.js
│   │   ├── test.js
│   │   ├── report.js
│   │   ├── config.js
│   │   ├── health.js
│   │   └── codegen.js
│   ├── wizards/              # Interactive wizard logic
│   │   ├── main-menu-wizard.js
│   │   ├── agent-setup-wizard.js
│   │   ├── agent-chat-wizard.js
│   │   ├── setup-wizard.js
│   │   ├── env-config-wizard.js
│   │   ├── mobile-config-wizard.js
│   │   └── test-wizard.js
│   └── utils/                # Shared helpers
│       ├── executor.js
│       └── config-manager.js
└── templates/                # Placeholder for config templates
```

Agent definitions live at the repo root under `.github/agents/`:

```
.github/agents/
├── wizard.agent.md               # Router agent — delegates to specialists
├── test-planner.agent.md         # Test plan generation from stories
├── api-automation-generator.agent.md  # API test code generation
├── ui-automation-generator.agent.md   # Playwright UI test generation
├── api-exploratory-test.agent.md      # Exploratory API testing
├── zephyr-test-case-converter.agent.md # Zephyr Scale upload
├── shared/                      # Shared reference docs
│   ├── format-examples.md
│   ├── glossary.md
│   └── test-case-formats.md
├── docs/                        # Detailed format specs
│   ├── api-test-case-format.md
│   └── non-api-test-case-format.md
└── templates/                   # Code generation templates
    ├── pom-class.template.js
    ├── schema.template.js
    ├── service-wrapper.template.js
    └── test-spec.template.js
```

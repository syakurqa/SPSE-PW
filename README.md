# Automation Monorepo Conventions

This guide summarizes the structural, naming, and coding conventions adopted across the `automation-monorepo`. Follow these rules whenever you add or update code so the API, Web, and shared modules stay consistent.

## QA CLI

The interactive CLI is the primary entry point for all QA tasks. Run it from the repo root:

```bash
npm run qa
```

This launches an interactive menu with these options:

| Option | Description |
| --- | --- |
| 🚀 **Setup** | Interactive setup wizard — configure environments, install deps, set up browsers |
| 🧪 **Test** | Run tests interactively — select type (api/web/mobile), env, browser mode, filters |
| 📊 **Reporting** | View API/web reports or start the dashboard |
| 💻 **Codegen** | Launch Playwright code generator for recording UI tests |
| 🔍 **Health Check** | Run all or individual health checks (env, DB, browser, test cases) |
| ⚙️ **Configuration** | View current environment and database settings |

## Monorepo Structure & Aliases

- **Workspace**: All packages live under `packages/*` and are managed with `npm workspaces`.
- **Module aliases** (via `alias-loader.mjs`):
  - `@api` → `packages/api-automation`
  - `@web` → `packages/web-automation`
  - `@common` → `packages/common-module`
  - `@fixtures` → `packages/common-module/fixtures`
- **Lint configuration**: The root `eslint.config.js` applies to every package. Individual packages can ship their own `eslint.config.js` for extra rules (see the API/Web packages).
- **Folder layout**:
  ```text
  automation-monorepo/
  ├── alias-loader.mjs
  ├── eslint.config.js
  ├── packages/
  │   ├── api-automation/
  │   │   ├── utils/
  │   │   ├── services/
  │   │   ├── tests/
  │   │   └── playwright.config.js
  │   ├── common-module/
  │   │   ├── config/
  │   │   ├── fixtures/
  │   │   ├── utils/
  │   │   └── package.json
  │   └── web-automation/
  │       ├── <domain>/
  │       │   ├── pom/
  │       │   ├── utils/
  │       │   └── tests/
  │       ├── hooks/
  │       └── playwright.config.js
  |
  |
  └── readme.md
  ```

## Naming & Formatting

- **JavaScript files** must use **kebab-case** (`check-file/filename-naming-convention` enforces this). Examples: `loan-calculation.js`, `example-with-sharable-api-module.spec.js`.
- **Directories** follow kebab-case unless representing API versions (for example `v2.1`).
- Use single quotes, terminate statements with `;`, and avoid `console.log` (disallowed by ESLint).
- Prefix throwaway variables or parameters with `_` to bypass the `no-unused-vars` rule.

## Local Setup & Editor Configuration

- **Initial setup**:
  1. Install dependencies: `npm install && npx playwright install chromium`.
  2. Duplicate the environment config files in `packages/common-module/config` (see *reference the team [Google Sheet](https://docs.google.com/spreadsheets/d/1b3YdmDeNuX3JzMjjCeeRalrch0jQpZ0a/edit?gid=1830312156#gid=1830312156)*) and fill in the values.
  3. Run the lint script for the package you will touch to confirm the setup: `npm run lint:api`, `npm run lint:web`, or `npm run lint:common-module`.
  4. Playwright Vs Code Extension installation check at https://playwright.dev/docs/getting-started-vscode
- **Text Editor (VS Code recommended)**:
  - Use Eslint Extension.
  - Vs Code project configuration at `.vscode/`
  - Ensure VS Code uses Node.js version >= 20 to match `package.json`.

## Config & Secrets Conventions

- The environment is selected via `process.env.ENV`. Allowed values: `SIT` (default) or `UAT`.
- Required config files live in `packages/common-module/config`:
  - `env.sit.json`, `env.uat.json` for secret value settings.
  - `db.sit.json`, `db.uat.json` for database connections.
- Never commit fresh secrets. Only check in placeholders or redacted data, then reference the team [Google Sheet](https://docs.google.com/spreadsheets/d/1iqv09Fo3P_4_soctVDLjbCwMTjun02pf0D8SVcOFDy4/edit?gid=0#gid=0) for the real values.

## API Automation Package (`packages/api-automation`)

- **Structure**:
  - `services/{microservice}/{feature}/*.js`: classes or functions that wrap outbound requests. 
  - `utils/`: reusable utilities such as `api.js` and `logger.js` for attaching request details to the report.
  - `tests/{microservice}/{path}/test-suite.spec.js`: Playwright scenarios for API testing.
  - `tests/{microservice}/{path}/test-suite.schema.js`: Json schema if you want to validate the response.
- **Test conventions**:
  - Write tests with Playwright Test (`test.describe`, `test(...)`).
  - Load secrets via `config.env` (`@common/index.js`).
  - Add test metadata in the options when you have a case ID (for example `{ tag: ['@TC-123','@TC-124'] }`).
- **Reporting**:
  - Playwright reporters produce HTML (`playwright-report`) and JSON (`playwright-report/json/test-results-<timestamp>.json`).
  - Keep `playwright-report/` out of commits unless a curated summary folder is required.

## Web Automation Package (`packages/web-automation`)

- **Structure**:
  - Domain folders (for example `los`, `lms`, `pbf`) store page objects (`pom/`), utilities, and tests.
  - `hooks/`: Playwright setup files (for example `pbf.setup.js`) that create seed data using `test as setup`.
  
- **UI testing**:
  - Place specs under `tests/**/*.spec.js` so they are picked up by `playwright.config.js`.
  - Use `test.step` or helper modules to keep long flows readable.
- **Playwright configuration**:
  - Tests run in parallel, trace is `on-first-retry`, screenshots are `on`, timezone is `Asia/Jakarta`.
  - Local runs create a timestamped `playwright-report/<ISO-timestamp>` directory. CI aggregates reports under `playwright-report/`.
  - The `setup` project executes hook files only (for example `pbf.setup.js`); prefix test names with `[Domain] ...` for easier filtering.

## Common Module Package (`packages/common-module`)

- Host shared utilities: config loaders, third-party integrations, DB helpers, and fixtures.
- `index.js` is the main entry point consumed as `@common/index.js`.
- `fixtures/` holds static assets (images, JSON). Use the `@fixtures` alias to avoid relative paths in tests.

## Fixtures & Test Data

- Store domain-specific mock JSON under the relevant package (`packages/api-automation/tests/<domain>/fixtures`) or in `@fixtures` if reused across packages.
- For sensitive data, commit templates with placeholders and document how to populate them locally.

## Linting, Commit, and Workflow

- Run package-specific lint scripts:
  - `npm run lint:api`
  - `npm run lint:web`
  - `npm run lint:common-module`
- Execute Playwright suites with `npm run test:api` or `npm run test:web`. Set `ENV=SIT` or `ENV=UAT` when needed.
- Before pushing:
  1. Refresh or verify local environment config.
  2. Run lint and tests for any impacted packages.
  3. Confirm Playwright reports are not staged for commit.

## Adding New Code

- Mirror existing folder/domain patterns; pick names that reflect the underlying service or feature.
- Add new helpers/services to the Common package if they will be shared—avoid duplication.
- When you introduce new commands, add them to the relevant `package.json` and document them briefly in the package README.

## MCP (Model Context Protocol) Setup for VS Code

- **Installation**:
  1. Install the **GitHub Copilot** extension in VS Code
  2. Open VS Code Settings (`Cmd+,` on macOS)
  3. Search for "MCP" or navigate to **GitHub Copilot > MCP Servers**
  4. Add the Atlassian MCP server configuration:
     ```json
     {
        "servers": {
          "jira-zephyr-mcp": {
          "type": "stdio",
          "command": "node",
          "args": [
            "/[path]/jira-zephyr-mcp/dist/index.js"
          ],
          "env": {
            "JIRA_BASE_URL": "https://bfifinance.atlassian.net/",
            "JIRA_USERNAME": "",
            "JIRA_API_TOKEN": "",
            "ZEPHYR_API_TOKEN": "",
          }
        },
          "atlassian": {
            "type": "http",
            "url": "https://mcp.atlassian.com/v1/mcp",
            "gallery": "https://api.mcp.github.com",
            "version": "1.1.1"
          }
        },
        "inputs": []
      }

     ```
  5. Restart VS Code to activate the MCP server
  6. Authenticate with Atlassian when prompted (requires valid Jira/Confluence access)


## Documentation & Updates

- Update this file whenever lint rules, package structure, or reporting strategies change.

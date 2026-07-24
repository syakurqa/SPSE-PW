# Web Automation Package

End-to-end Playwright suites for BFI web products. For shared setup (Node version, environment files, lint rules, editor config), refer to the monorepo `README.md`.

## Directory Highlights

```text
packages/web-automation/
├── hooks/                  # Playwright setup projects (data seeding, account prep)
├── <platform>/             # e.g. pbf, surveyor-platform, operation-platform, lms, 
│   ├── pom/                # Page object models
│   │   └──<feature>/       
│   │       └──*.page.js
│   ├── utils/              # platform helpers, workflows, data builders
│   ├── fixtures/           # Optional platform fixtures
│   ├── constants/          # Constant files
│   └── tests/              # UI specs
│   │   └──<feature>/       
│   │       └──*.spec.js
├── eslint.config.js
├── lint-staged.config.js
└── playwright.config.js
```

- Each platform folder encapsulates everything needed for that product area. Keep selectors inside `pom/` classes and call them from tests.
- `hooks/` is executed via the Playwright `setup` project to preload state or seed users before UI flows run.
- Reusable assets that span domains should live in `@automation/common-module/fixtures`.

## Commands

| Command | Description |
| --- | --- |
| `npm run lint:web` | Lint this workspace (alias loader already configured). |
| `npm run test:web` | Run all Playwright projects headlessly. |
| `npm run test:web:headed` | Launch tests with a visible browser. |
| `npm run test:web:ui` | Launch Playwright test UI mode for interactive testing. |
| `npm run codegen:web` | Open Playwright code generator for recording actions. |
| `npm run report:web` | Open the most recent HTML report. |
| `npm run cleaning-data-sf --workspace=packages/web-automation` | Domain-specific data maintenance script (PBF). |

## Working With Domains

1. Create or update page objects in `<platform>/pom`.
2. Add helpers or workflows to `<platform>/utils`.
3. Add constants variable to `<platform>/constant`.
4. Place fixtures alongside the tests that consume them.
5. Add specs under `<platform>/tests` using descriptive names such as `pbf/tests/survey/customer-company-job.spec.js`.
6. Run `npm run lint:web` plus the affected Playwright projects before opening a PR.

Consult `README.md` for alias usage, naming conventions, handling secrets, and general troubleshooting tips.


# Page Object Model Guide

This document outlines the page object conventions used in `packages/web-automation`. Follow these rules so every platform domain keeps a consistent structure, naming scheme, and code style.

## Goals
- Separate selectors from test logic to keep scenarios concise.
- Ensure every page object remains maintainable and reusable across scenarios.

## Class Structure
Each `pom/*.page.js` file must export a single page object class. A basic template:

```javascript
import { test, expect } from '@playwright/test';

export default class LoginPage {
  constructor(page) {
    this.page = page;

    // Store every selector inside the constructor
    this.usernameField = page.getByRole('textbox', { name: 'Username' });
    this.passwordField = page.locator('[data-testid="password"]');
    this.submitButton = page.getByRole('button', { name: 'Masuk' });
    this.successToast = page.getByText('Login berhasil');
  }

  async fillCredentialsAction( username, password) {
    await test.step('Fill login credentials', async () => {
      await this.usernameField.fill(username);
      await this.passwordField.fill(password);
    });
  }

  async submitLoginAction() {
    await test.step('Submit login', async () => {
      await this.submitButton.click();
    });
  }

  async successLoginAssert() {
    await test.step('Validate success toast', async () => {
      await expect(this.successToast).toBeVisible();
    });
  }
}
```

### Selector Rules
- Declare all locators inside the constructor and store them as `this.<selectorName>` properties.
- Prefer stable Playwright selectors such as `getByRole`, `getByTestId`, or `locator`.
- For dynamic values, keep helper builders like `this.option = value => this.page.getByRole(...)`.

## Additional Tips
- Chain related steps together when they always run in sequence (for example, `loginAction` that fills credentials and clicks submit).
- Break out reusable pieces of complex pages into `component.page.js`.
- If you want to create step Action but the step only click or fill as one step so you dont need to create an Action step function, just call the pom selector and chaining for click or fill or etc.
- Run `npm run lint:web` after adding or updating a page object to keep lint rules satisfied.

Update this document whenever POM conventions change or new examples need to be documented.


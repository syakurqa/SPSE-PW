# Common Module Package

Shared configuration, fixtures, database helpers, and third-party integrations consumed by every workspace. Global setup, credentials handling, and naming rules are defined once in `README.md`; this document captures what is unique to `@automation/common-module`.

## Directory Highlights

```text
packages/common-module/
├── config/            # env/db JSON (selected via process.env.ENV)
├── db/                # Query helpers grouped by database domain
├── fixtures/          # Assets shared across packages
├── utils/             # Reusable helpers (integrations, reports, etc.)
│   ├── integrations/
│   ├── reports/
│   └── helpers/
├── index.js           # Entry point that re-exports config, db, utils
├── eslint.config.js
└── lint-staged.config.js
```

Key expectations:

- Environment files must exist in `config/` for each supported target (`env.sit.json`, `env.uat.json`, etc.). Keep schemas aligned; see `README.md` for sourcing secrets.
- Fixtures intended for a single package should stay with that package. Use `@fixtures` (symlinked to this module) only for truly shared assets.
- Utility modules provide cross-cutting capabilities such as Zephyr reporting (`utils/integrations/`) and random data builders (`utils/helpers/`).

## Commands

| Command | Description |
| --- | --- |
| `npm run lint:common-module` | Lint this workspace using the shared alias loader. |
| `npm run zephyr:test-cycle:playwright --workspace=packages/common-module` | Publish a Playwright result bundle to Zephyr. |

Follow the contribution checklist in `README.md` (lint, tests, secrets) before pushing updates. When exporting new helpers, expose them via `index.js` so other packages can continue importing from `@common/...`.

### Regression Aggregation

| Command | Description |
|---------|-------------|
| `npm run zephyr:regression:aggregate` | Collects and aggregates regression test results, then uploads them to Zephyr. |
| `npm run test:regression-aggregator` | Runs unit tests for the aggregator script using Node's built-in test runner. |

**Usage:**

```bash
# Aggregate regression results and push to Zephyr
npm run zephyr:regression:aggregate

# Verify the aggregator script itself is working correctly
npm run test:regression-aggregator
```

Run `zephyr:regression:aggregate` after a regression suite finishes to consolidate results across runs and sync them to Zephyr. Run `test:regression-aggregator` when modifying `utils/pipeline-utils/reports/aggregate-regression.js` to confirm the logic is correct.

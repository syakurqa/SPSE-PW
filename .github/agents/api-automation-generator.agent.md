---
description: 'Create complete API automation tests including service wrappers, schemas, and test specs. Handles end-to-end implementation from endpoint to runnable tests.'
tools: ['execute/getTerminalOutput', 'execute/runInTerminal', 'read/readFile', 'read/terminalSelection', 'read/terminalLastCommand', 'edit', 'search', 'todo']
---

# API Test Creator Agent

## Purpose
Automate the complete creation of API automation tests in the monorepo, including:
- Service wrapper API client classes
- JSON schemas for request/response validation
- Playwright test spec files
- Environment configuration updates
- Linting and test execution

## Workflow

### 1. Information Gathering Phase
Before starting implementation, collect:

**Required Information:**
- [ ] Service name (e.g., `auth-service`, `credit-assessment`)
- [ ] API version (e.g., `v1`, `v2`)
- [ ] Resource/endpoint path (e.g., `/refresh_token/deactivate`)
- [ ] HTTP method(s) to test (GET, POST, PUT, DELETE)
- [ ] Request payload structure (if applicable)
- [ ] Expected response schema
- [ ] Test case ID prefix (e.g., `@PFM-T###`, `@API-T###`)
- [ ] Environment (SIT/UAT or both)

**Optional Information:**
- Test scenarios beyond happy path (validation errors, auth failures, etc.)
- Existing service wrapper to extend
- Business logic requirements
- Performance expectations

### 2. Implementation Phase

#### Step 2.1: Create Service Wrapper
**Location:** `packages/api-automation/services/<service-name>/<client-file>.api.js`

**Template:** [service-wrapper.template.js](./templates/service-wrapper.template.js)

**Requirements:**
- Class name: PascalCase, descriptive
- Methods: static async
- Return format: `{ resObject, status, data }`
- Authentication/headers handled in client

#### Step 2.2: Create Schemas
**Location:** `packages/api-automation/tests/<service>/<version>/<resource>/<resource>.schema.js`

**Template:** [schema.template.js](./templates/schema.template.js)

**Requirements:**
- Export multiple schemas (success, error, validation)
- Use JSON Schema format with required fields and types
- Keep schemas beside test specs

#### Step 2.3: Create Test Spec
**Location:** `packages/api-automation/tests/<service>/<version>/<resource>/<resource>.spec.js`

**Template:** [test-spec.template.js](./templates/test-spec.template.js)

**Requirements:**
- Follow AAA pattern (see [glossary.md](./shared/glossary.md))
- Include test case ID tags and `@smoke` for critical tests
- Use descriptive test names: `Should <action> when <condition>`
- Validate status, code, and schema
- Cover positive and negative scenarios

#### Step 2.4: Update Environment Config
**Location:** `packages/common-module/config/env.sit.json` and `env.uat.json`

Add new configuration keys:
```json
{
  "MS_PRIVATE_BASE_URL": "https://microservices-private.sit.bravo.bfi.co.id",
  "NEW_SERVICE_API_KEY": "your-api-key",
  "NEW_SERVICE_SECRET": "your-secret"
}
```

**Key Points:**
- Add to both SIT and UAT configs
- Never hard-code secrets in tests
- Use descriptive key names
- Avoid duplicating existing configs

### 3. Validation Phase

#### Step 3.1: Run Linter
```bash
npm run lint
```

**Linting Strategy:** See [glossary.md](./shared/glossary.md)
- Auto-fix: imports, unused variables, formatting
- **NEVER fix `playwright-custom/require-valid-tag`** - requires manual config

#### Step 3.2: Run Tests
```bash
npx playwright test packages/api-automation/tests/<service>/<version>/<resource>
```

**Troubleshooting:**
- Check environment variables are loaded
- Verify service wrapper returns correct structure
- Validate schema matches actual response
- Check authentication/authorization
- Review network errors or timeouts

#### Step 3.3: Generate Report
```bash
npx playwright show-report
```

Verify:
- All tests pass
- No flaky tests
- Response times acceptable
- Schema validations pass

## Best Practices

**See:** [glossary.md](./shared/glossary.md) for common patterns and standards

### Code Organization
- Keep related files together (spec + schema)
- One service wrapper per service
- Reuse utilities and helpers

### Test Design
- Test one thing per test case
- Use descriptive names following API format
- Include positive, negative, and edge cases
- Tag appropriately

### Maintenance
- Document contract references
- Keep schemas current
- Update when API changes

## Common Test Scenarios

**See:** [test-case-formats.md](./shared/test-case-formats.md#api-testing-coverage) for comprehensive coverage

### Quick Reference
- **Authentication**: Valid/invalid credentials, missing/expired/invalid tokens → 200/401
- **CRUD**: Create, Read, Update, Delete operations with valid/invalid data → 200/201/400/404
- **Validation**: Required fields, types, formats, lengths → 400/422
- **Business Logic**: State transitions, constraints, idempotency, concurrency

## Checklist Before Completion

- [ ] Service wrapper created and follows template
- [ ] Schemas defined for success and error cases
- [ ] Test spec created with appropriate scenarios
- [ ] Environment configs updated (SIT & UAT)
- [ ] All imports resolved correctly
- [ ] Linter passes without errors
- [ ] Tests execute successfully
- [ ] Test case IDs assigned
- [ ] Appropriate tags added
- [ ] Documentation/comments added
- [ ] Contract references included
- [ ] Code follows project conventions

## Example Directory Structure

```
packages/api-automation/
├── services/
│   └── auth-service/
│       └── token-service.api.js
└── tests/
    └── auth-service/
        └── v2/
            └── refresh_token/
                └── deactivate/
                    ├── deactivated-refresh-token.spec.js
                    └── deactivated-refresh-token.schema.js
```

## Related Documentation
- Project README: `packages/api-automation/README.md`
- Common utilities: `packages/common-module/README.md`

## Tips for Success
1. Always gather complete requirements before coding
2. Review existing service wrappers for patterns
3. Test as you build, don't wait until the end
4. Use meaningful variable and function names
5. Keep tests independent and isolated
6. Document non-obvious logic
7. Update schemas when APIs change
8. Run full test suite before committing

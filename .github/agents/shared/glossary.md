# Testing Glossary & Common Patterns

## Testing Patterns

### AAA Pattern (Arrange-Act-Assert)
Standard test structure:
- **Arrange**: Setup test data and preconditions
- **Act**: Execute the functionality being tested
- **Assert**: Verify the expected outcome

### POM (Page Object Model)
Design pattern for UI tests that creates object-oriented classes for each web page, encapsulating page elements and actions.

## Code Quality Standards

### Linting Strategy
- Run ESLint on all generated files
- Auto-fix: imports, unused variables, formatting, quotes, semicolons
- **NEVER fix `playwright-custom/require-valid-tag`** - requires manual configuration
- Document remaining issues for manual review

### Import Order
1. External packages (@playwright/test)
2. Internal modules (@api, @common, @web)
3. Relative imports (./schema, ../utils)

## Common Workflows

### Test Execution Flow
1. Setup: Environment config, test data, authentication
2. Execute: Run test actions
3. Validate: Assert expected results
4. Cleanup: Reset state, close connections

### Environment Configuration
- Never hard-code secrets in tests
- Use descriptive key names
- Support multiple environments (SIT/UAT)
- Store in `packages/common-module/config/env.*.json`

## Best Practices

### Test Design
- Test one thing per test case
- Use descriptive names following format conventions
- Include positive and negative scenarios
- Add edge cases and boundary conditions
- Tag appropriately (@smoke, test IDs)

### Code Organization
- Keep related files together
- Reuse utilities and helpers
- Follow project conventions
- Document non-obvious logic

### Maintenance
- Keep schemas/contracts up to date
- Review failures promptly
- Update when dependencies change
- Refactor duplicate code

import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint-base.config.js';
import customTestTaggingRules from '../../eslint-plugin-test-tagging-rules.js';

export default defineConfig([
  globalIgnores(['playwright.config.js', 'playwright-report/*']),
  ...baseConfig,
  {
    files: ['**/tests/**/*.spec.js'],
    plugins: {
      playwright,
      'test-tagging': customTestTaggingRules,
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-focused-test': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-duplicate-hooks': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/expect-expect': 'off',
      'playwright/no-conditional-in-test': 'off',
      'test-tagging/require-valid-tag': 'error',
    },
  },
]);

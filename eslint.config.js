import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import baseConfig from './eslint-base.config.js';

export default defineConfig([
  globalIgnores(['**/.github/agents/**', 'playwright.config.js']),
  ...baseConfig,
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**'],
    rules: {
      'no-empty-pattern': 'off',
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-focused-test': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-duplicate-hooks': 'error',
      'playwright/missing-playwright-await': 'error',
    },
  },
]);

// @ts-check
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authStatePath = path.resolve(__dirname, 'spse/.auth/ppk.json');

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');
const baseReportDir = process.env.CI === 'true' ? './playwright-report/' : `./playwright-report/${timestamp}`;
const isCi = process.env.CI === 'true';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testMatch: ['**/spse/tests/**/*.spec.js'],
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 2 : undefined,
  reporter: process.env.CI === 'true' ? 'blob' : [
    [
      'html',
      {
        open: 'never',
        outputFolder: `${baseReportDir}/html`,
      },
    ],
    [
      'json',
      { outputFile: `${baseReportDir}/test-results.json` }
    ]
  ],
  expect: { timeout: 10000 },
  use: {
    ignoreHTTPSErrors: true,
    channel: process.env.SPSE_BROWSER_CHANNEL || undefined,
    userAgent: process.env.SPSE_USER_AGENT || undefined,
    launchOptions: { slowMo: parseInt(process.env.SLOW_MO || '0', 10), },
    video: 'on',
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH || '1470', 10),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '798', 10)
    },
    actionTimeout: 20 * 1000,
    navigationTimeout: 60 * 1000,
    timezoneId: 'Asia/Jakarta',
    screenshot: 'on',
    permissions: ['geolocation', 'local-network-access']
  },
  projects: [
    {
      name: 'spse-auth',
      testMatch: /spse\/tests\/setup\/auth\.setup\.js/,
    },
    {
      name: 'spse',
      testMatch: /spse\/tests\/.*\.spec\.js/,
      testIgnore: /spse\/tests\/(?:diagnostics\/|e2e\/flow6-inspect\.spec\.js)/,
      use: {
        storageState: process.env.SPSE_USE_AUTH_STATE === 'true'
          ? authStatePath
          : undefined,
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'spse-upload-capture',
      testMatch: /spse\/tests\/diagnostics\/upload-capture\.spec\.js/,
      dependencies: ['spse-auth'],
      use: {
        storageState: authStatePath,
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-tender-inspect',
      testMatch: /spse\/tests\/diagnostics\/tender-inspect\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-session-inspect',
      testMatch: /spse\/tests\/diagnostics\/session-inspect\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow6-inspect',
      testMatch: /spse\/tests\/diagnostics\/flow6-upload-inspect\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow6-form-inspect',
      testMatch: /spse\/tests\/e2e\/flow6-inspect\.spec\.js/,
      use: {
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow7-9-inspect',
      testMatch: /spse\/tests\/diagnostics\/flow7-9-inspect\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow10-debug',
      testMatch: /spse\/tests\/diagnostics\/flow10-sppbj-save-debug\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow11-discover',
      testMatch: /spse\/tests\/diagnostics\/flow11-contract-discover\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow12-discover',
      testMatch: /spse\/tests\/diagnostics\/flow12-provider-discover\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'spse-flow3-evaluate',
      testMatch: /spse\/tests\/diagnostics\/flow3-evaluate-current\.spec\.js/,
      use: {
        trace: 'on',
        video: 'retain-on-failure',
      },
    },
  ],
});

// @ts-check
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-');
const baseReportDir = process.env.CI == 'true' ? './playwright-report/' : `./playwright-report/${timestamp}`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testMatch: ['**/(ekatalog|spse)/tests/**/*.spec.js'],
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI == 'true' ? 'blob' : [
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
      name: 'ekatalog',
      testMatch: /ekatalog\/tests\/.*\.spec\.js/
    },
    {
      name: 'spse',
      testMatch: /spse\/tests\/.*\.spec\.js/
    },
  ],
});

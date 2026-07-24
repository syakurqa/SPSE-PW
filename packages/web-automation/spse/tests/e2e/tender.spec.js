import { test, expect } from '../../fixtures/base.fixture.js';

test.describe('SPSE E2E - Tender Flow', () => {
  test('TC-SPSE-002: Sample End-to-End Tender Search', async ({ page }) => {
    const baseUrl = process.env.SPSE_BASE_URL || 'https://spse-sit.example.com';
    await page.goto(baseUrl);
    await expect(page).toBeDefined();
  });
});

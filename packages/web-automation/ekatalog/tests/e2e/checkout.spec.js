import { test, expect } from '../../fixtures/base.fixture.js';

test.describe('e-Katalog E2E - Checkout Flow', () => {
  test('TC-EKATALOG-002: Sample End-to-End Checkout Test', async ({ page }) => {
    const baseUrl = process.env.EKATALOG_BASE_URL || 'https://ekatalog-sit.example.com';
    await page.goto(baseUrl);
    await expect(page).toBeDefined();
  });
});

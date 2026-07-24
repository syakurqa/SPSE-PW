import { test, expect } from '../../fixtures/base.fixture.js';

test.describe('SPSE Sanity - Authentication', () => {
  test('TC-SPSE-001: Should load SPSE login page successfully', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(page).toHaveTitle(/SPSE|Sistem Pengadaan Secara Elektronik/i);
  });
});

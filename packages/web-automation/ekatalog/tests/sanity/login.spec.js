import { test, expect } from '../../fixtures/base.fixture.js';

test.describe('e-Katalog Sanity - Authentication', () => {
  test('TC-EKATALOG-001: Should load login page successfully', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(page).toHaveTitle(/e-Katalog|Login/i);
  });
});

import { test, expect } from '@playwright/test';

export default class FeatureNamePage {
  constructor(page) {
    this.page = page;

    // Store selectors in constructor
    this.someField = page.getByRole('textbox', { name: 'Label' });
    this.someButton = page.getByRole('button', { name: 'Submit' });
    this.someElement = page.locator('[data-testid="element-id"]');
  }

  async fillFormAction(data) {
    await test.step('Fill form fields', async () => {
      await this.someField.fill(data.value);
    });
  }

  async submitAction() {
    await test.step('Submit form', async () => {
      await this.someButton.click();
    });
  }

  async verifySuccessAssert(expectedData) {
    await test.step('Verify submission success', async () => {
      await expect(this.successMessage).toBeVisible();
      await expect(this.someElement).toContainText(expectedData.text);
    });
  }
}

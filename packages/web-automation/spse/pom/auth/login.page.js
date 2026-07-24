export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[name="user_id"], #username');
    this.passwordInput = page.locator('input[name="password"], #password');
    this.submitButton = page.locator('button[type="submit"], input[type="submit"]');
  }

  async goto(baseUrl = process.env.SPSE_BASE_URL || 'https://spse-sit.example.com') {
    await this.page.goto(`${baseUrl}/eproc4/login`);
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

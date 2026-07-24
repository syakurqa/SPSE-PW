export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[name="email"], #username');
    this.passwordInput = page.locator('input[name="password"], #password');
    this.submitButton = page.locator('button[type="submit"], #login-btn');
  }

  async goto(baseUrl = process.env.EKATALOG_BASE_URL || 'https://ekatalog-sit.example.com') {
    await this.page.goto(`${baseUrl}/login`);
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

import { test } from '@playwright/test';
export default class KeycloakLoginPage {
  constructor(page) {
    this.page = page;
    this.usernameField = page.locator('[id="username"]');
    this.passwordField = page.locator('[id="password"]');
    this.loginButton = page.locator('[id="kc-login"]');
    this.ssoButton = page.getByTestId('login-btn');
    this.ssoEmailInput = page.locator('#identifierId');
    this.ssoPasswordInput = page.locator('input[name="Passwd"]');
    this.ssoNextButton = page.getByRole('button', { name: 'Next' });
    this.confirmButton = page.locator('#confirm');
    this.useravatarButton = page.locator('[id="basic-button"]');
    this.logoutButton = page.getByTestId('LogoutIcon');
  }

  /**
     * Logs in to the specified platform with the provided username and password.
     *
     * @param {Object} options - The options for logging in.
     * @param {string} options.platformUrl - The URL of the platform to log in to.
     * @param {string} options.username - The username to log in with.
     * @param {string} options.password - The password to log in with.
     * @return {Promise<void>} A promise that resolves when the login is complete.
     */
  async loginAction({
    platformUrl, username, password, type = 'default'
  }) {
    await test.step(`[Keycloak] Login to ${platformUrl} with username: ${username} and password: ${password}`, async () => {
      if (platformUrl) {
        await this.page.goto(platformUrl, { waitUntil: 'domcontentloaded' });
        // await this.page.pause();
      }
      if (type == 'GWS') {
        if (await isElementVisible(this.ssoEmailInput)) {
          await this.ssoEmailInput.fill(username);
          await this.ssoNextButton.click();
          await this.ssoPasswordInput.fill(password);
          await this.ssoNextButton.click();
          if (await isElementVisible(this.confirmButton)) {
            await this.confirmButton.click();
          }
        } else if (await isElementVisible(this.ssoButton)) {
          await this.ssoButton.click();
          await this.ssoEmailInput.fill(username);
          await this.ssoNextButton.click();
          await this.ssoPasswordInput.fill(password);
          await this.ssoNextButton.click();
          if (await isElementVisible(this.confirmButton)) {
            await this.confirmButton.click();
          }
        }
      } else {
        await this.usernameField.fill(username);
        await this.passwordField.fill(password);
        await this.loginButton.click();
      }
    });
  }

  async logoutAction() {
    await this.useravatarButton.click();
    await this.logoutButton.click();
  }
}

async function isElementVisible(locator, timeout = 5000) {
  try {
    await locator.waitFor({
      state: 'visible',
      timeout
    });
    return true;
  } catch {
    return false;
  }
}

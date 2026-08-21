import { PokjaLoginPage } from './pokja-login.page.js';
import { captureGuideStep } from '../../utils/guide-capture.js';

export class ProviderLoginPage extends PokjaLoginPage {
  async login({ username, password }, baseUrl) {
    if (!username || !password) {
      throw new Error('Kredensial Penyedia belum dikonfigurasi.');
    }
    const activePage = await super.login({
      username,
      password
    }, baseUrl);
    if (!await this.isAuthenticated(activePage)) {
      throw new Error(`Login Penyedia gagal. URL terakhir: ${activePage.url()}`);
    }
    return activePage;
  }

  async completeCredentials(username, password) {
    const emailInput = this.page.getByRole('textbox', { name: 'Alamat email' });
    if (!await emailInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      return;
    }
    await captureGuideStep(this.page, {
      instruction: 'Isi Alamat email akun Penyedia',
      action: 'Isi',
      target: emailInput,
      expected: 'Email Penyedia siap diproses.',
    });
    await emailInput.fill(username);
    await this.page.getByRole('button', {
      name: 'Lanjut',
      exact: true,
    }).click({ noWaitAfter: true });

    const passwordInput = this.page.getByRole('textbox', { name: 'Sandi' });
    await passwordInput.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Isi Sandi akun Penyedia',
      action: 'Isi',
      target: passwordInput,
      expected: 'Sandi tersimpan secara tersensor.',
    });
    await passwordInput.fill(password);
    await this.page.getByRole('button', {
      name: 'Lanjut',
      exact: true,
    }).click({ noWaitAfter: true });
    await this.page.waitForTimeout(2000);
  }

  async selectPokjaRole(page) {
    await this.bypassSecurityKey(page);
    await page.waitForTimeout(1200);
    if (await this.isAuthenticated(page, 3000)) {
      return;
    }

    const roleButtons = page.locator('button[id^="login-pesona-"]');
    const desiredRoleId = await roleButtons.evaluateAll((buttons) => {
      for (const button of buttons) {
        const row = button.closest('tr');
        const context = (row?.innerText || '').toLowerCase();
        if (context.includes('penyedia') || context.includes('angsae baru')) {
          return button.id;
        }
      }
      return null;
    }).catch(() => null);
    if (!desiredRoleId) {
      throw new Error('Pilihan role Penyedia Angsae Baru tidak tersedia.');
    }
    const target = page.locator(`#${desiredRoleId}`);
    await captureGuideStep(page, {
      instruction: 'Pilih role Penyedia Angsae Baru',
      action: 'Pilih',
      target,
      expected: 'Dashboard Penyedia terbuka.',
    });
    await target.click();
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }

  async isAuthenticated(page, timeout = 30000) {
    const navigation = page.getByRole('link', { name: /DAFTAR PAKET|PAKET BARU/i, }).first();
    if (!await navigation.isVisible({ timeout }).catch(() => false)) {
      return false;
    }
    return page.getByText(/ANGSAE BARU\s*-\s*Penyedia/i).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
  }
}

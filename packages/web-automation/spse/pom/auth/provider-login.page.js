import { PokjaLoginPage } from './pokja-login.page.js';
import { captureGuideStep } from '../../utils/guide-capture.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ProviderLoginPage extends PokjaLoginPage {
  get actorLabel() {
    return 'Penyedia';
  }

  async login({
    username,
    password,
    displayName = 'ANGSAE BARU',
  }, baseUrl) {
    if (!username || !password) {
      throw new Error('Kredensial Penyedia belum dikonfigurasi.');
    }
    if (!displayName?.trim()) {
      throw new Error('Nama tampilan Penyedia belum dikonfigurasi.');
    }
    this.providerDisplayName = displayName.trim();
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

    const displayNamePattern = new RegExp(
      escapeRegExp(this.providerDisplayName),
      'i'
    );
    const desiredRows = page.locator('tr')
      .filter({ hasText: displayNamePattern, })
      .filter({ hasText: /\bPenyedia\b/i, });
    const matchingRows = await desiredRows.count();
    if (matchingRows !== 1) {
      throw new Error(
        `Role Penyedia "${this.providerDisplayName}" harus tepat satu, `
        + `aktual ${matchingRows}.`
      );
    }
    const target = desiredRows.locator(
      'button[id^="login-pesona-"]'
    ).first();
    await target.waitFor({
      state: 'visible',
      timeout: 20000
    });
    await captureGuideStep(page, {
      instruction: `Pilih role Penyedia ${this.providerDisplayName}`,
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
    const identityPattern = new RegExp(
      `${escapeRegExp(this.providerDisplayName)}\\s*-\\s*Penyedia`,
      'i'
    );
    return page.getByText(identityPattern).first()
      .isVisible({ timeout: 10000 }).catch(() => false);
  }
}

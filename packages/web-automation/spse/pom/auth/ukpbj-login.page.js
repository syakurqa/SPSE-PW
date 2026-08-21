import { captureGuideStep } from '../../utils/guide-capture.js';

export class UkpbjLoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.emailInput = page.getByRole('textbox', { name: 'Alamat email' }).or(
      page.locator('input[name="email"], input[type="email"], input[name="username"]')
    ).first();
    this.passwordInput = page.getByRole('textbox', { name: 'Sandi' }).or(
      page.locator('input[name="password"], input[type="password"]')
    ).first();
    this.continueButton = page.getByRole('button', {
      name: 'Lanjut',
      exact: true
    }).or(page.locator('button[type="submit"], button#login-btn')).first();
    this.bypassSecurityKeyButton = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i, });
  }

  async login(email, password, baseUrl) {
    if (!email || !password) {
      throw new Error(
        'SPSE_UKPBJ_USERNAME dan SPSE_UKPBJ_PASSWORD wajib dikonfigurasi.'
      );
    }
    await this.page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    if (await this.isAuthenticated(3000)) {
      return;
    }
    const loginLink = this.page.locator(
      'a:has-text("LOGIN"), button:has-text("LOGIN")'
    ).first();
    if (await loginLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Klik LOGIN untuk masuk sebagai Kepala UKPBJ',
        target: loginLink,
        expected: 'Halaman autentikasi INAPROC terbuka.'
      });
      await loginLink.click();
    }

    if (await this.emailInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Isi Alamat email akun Kepala UKPBJ',
        action: 'Isi',
        target: this.emailInput,
        expected: 'Email siap diproses.'
      });
      await this.emailInput.fill(email);
      await captureGuideStep(this.page, {
        instruction: 'Klik Lanjut setelah email Kepala UKPBJ',
        target: this.continueButton,
        expected: 'Form Sandi ditampilkan.'
      });
      await this.continueButton.click();
      await this.passwordInput.waitFor({
        state: 'visible',
        timeout: 30000
      });
      await captureGuideStep(this.page, {
        instruction: 'Isi Sandi Kepala UKPBJ',
        action: 'Isi',
        target: this.passwordInput,
        expected: 'Sandi tersimpan secara tersensor.'
      });
      await this.passwordInput.fill(password);
      await this.continueButton.click();
      await this.page.waitForTimeout(1500);
    }

    // Bypass Security Key (hingga 8 kali pengecekan bertahap)
    for (let attempt = 0; attempt < 8; attempt++) {
      const bypassBtn = this.page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i });
      if (!await bypassBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        if (await this.page.locator('button[id^="login-pesona-"]').first().isVisible({ timeout: 2000 }).catch(() => false)) {
          break;
        }
        continue;
      }
      await captureGuideStep(this.page, {
        instruction: 'Klik Lanjutkan tanpa Security Key',
        target: bypassBtn,
        expected: 'Halaman pemilihan role ditampilkan.'
      });
      await bypassBtn.click({
        force: true,
        noWaitAfter: true
      });
      await this.page.waitForTimeout(1500);
      if (await this.page.locator('button[id^="login-pesona-"]').first().isVisible({ timeout: 2000 }).catch(() => false)) {
        break;
      }
    }

    const fixedRoleButton = this.page.locator('#login-pesona-4-btn');
    if (await fixedRoleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Pilih role Kepala UKPBJ',
        action: 'Pilih',
        target: fixedRoleButton,
        expected: 'Dashboard Kepala UKPBJ terbuka.'
      });
      await fixedRoleButton.click();
    } else {
      const roleButton = this.page.locator(
        'button[id^="login-pesona-"]'
      ).filter({ hasText: /Kepala UKPBJ/i }).first();
      await roleButton.waitFor({
        state: 'visible',
        timeout: 15000
      });
      await roleButton.click();
    }

    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    let authenticated = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      if (await this.isAuthenticated(2000)) {
        authenticated = true;
        break;
      }
      const bypassBtn = this.page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i, });
      if (await bypassBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await bypassBtn.click({
          force: true,
          noWaitAfter: true
        });
      }
      await this.page.waitForTimeout(2000);
    }
    if (!authenticated) {
      throw new Error(
        `Login Kepala UKPBJ gagal. URL terakhir: ${this.page.url()}`
      );
    }
  }

  async isAuthenticated(timeout = 30000) {
    const navigationVisible = await this.page.getByRole('link', { name: /DAFTAR PAKET/i }).first().isVisible({ timeout }).catch(() => false);
    if (!navigationVisible) {
      return false;
    }
    return this.page.getByText(/Kepala UKPBJ/i).first().isVisible({ timeout: 10000 }).catch(() => false);
  }
}

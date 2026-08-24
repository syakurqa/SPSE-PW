import { captureGuideStep } from '../../utils/guide-capture.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.initializeLocators();
  }

  initializeLocators() {
    const page = this.page;
    this.loginLink = page.locator('a:has-text("LOGIN"), button:has-text("LOGIN")').first();
    this.emailInput = page.getByRole('textbox', { name: 'Alamat email' }).or(
      page.locator('input[name="email"], input[type="email"], input[name="username"], input[name*="email" i], input[placeholder*="namapengguna" i]')
    ).first();
    this.passwordInput = page.getByRole('textbox', { name: 'Sandi' }).or(
      page.locator('input[name="password"], input[type="password"]')
    ).first();
    this.continueButton = page.getByRole('button', {
      name: 'Lanjut',
      exact: true
    }).or(
      page.locator('button#login-btn, button:has-text("Masuk atau Daftar"), button[type="submit"]')
    ).first();
    this.bypassSecurityKeyButton = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i, });
  }

  async goto(baseUrl) {
    if (!baseUrl) {
      throw new Error('SPSE base URL belum dikonfigurasi.');
    }
    await this.page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  }

  async login(email, password, baseUrl, {
    organization = 'DINAS KESEHATAN',
    role = 'PPK',
  } = {}) {
    if (!email || !password) {
      throw new Error('Kredensial PPK belum dikonfigurasi.');
    }
    if (baseUrl) {
      await this.goto(baseUrl);
    }

    if (await this.isAuthenticated(this.page, 3000)) {
      return this.page;
    }

    if (await this.loginLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Klik LOGIN untuk masuk sebagai PPK',
        target: this.loginLink,
        expected: 'Halaman autentikasi INAPROC terbuka.'
      });
      await this.loginLink.click();
    }

    const accessDenied = this.page.getByRole('heading', { name: /Akses Anda Ditolak/i });
    if (await accessDenied.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.page.getByRole('button', {
        name: 'Masuk',
        exact: true
      }).click();
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);

      if (await this.loginLink.isVisible({ timeout: 10000 }).catch(() => false)) {
        await this.loginLink.click();
        await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      }
    }

    // Step 1: Input Email
    if (await this.emailInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Isi Alamat email akun PPK',
        action: 'Isi',
        target: this.emailInput,
        expected: 'Email siap diproses.'
      });
      await this.emailInput.fill(email);
      await this.emailInput.dispatchEvent('input').catch(() => null);
      await this.emailInput.dispatchEvent('change').catch(() => null);

      for (let i = 0; i < 20; i++) {
        if (await this.continueButton.isEnabled().catch(() => false)) {
          break;
        }
        await this.page.waitForTimeout(500);
      }

      await captureGuideStep(this.page, {
        instruction: 'Klik Lanjut setelah email PPK',
        target: this.continueButton,
        expected: 'Form Sandi ditampilkan.'
      });
      await this.continueButton.click({ force: true });
      await this.page.waitForTimeout(1000);
    }

    // Step 2: Input Password (bisa di form yang sama atau halaman redirect Auth0)
    const passwordInput = this.page.getByRole('textbox', { name: 'Sandi' }).or(
      this.page.locator('input[name="password"], input[type="password"]')
    ).first();

    if (await passwordInput.isVisible({ timeout: 30000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Isi Sandi PPK',
        action: 'Isi',
        target: passwordInput,
        expected: 'Sandi tersimpan secara tersensor.'
      });
      await passwordInput.fill(password);
      await passwordInput.dispatchEvent('input').catch(() => null);
      await passwordInput.dispatchEvent('change').catch(() => null);

      const submitPass = this.page.getByRole('button', {
        name: 'Lanjut',
        exact: true
      }).or(
        this.page.locator('button[type="submit"]')
      ).first();
      await submitPass.click({ force: true });
      await this.page.waitForTimeout(1500);
    }

    // Step 3: Bypass Security Key jika ada
    await this.bypassSecurityKey(this.page);

    // Step 4: Pilih SPSE Staging di Manajemen Akses jika mendarat di account.eproc.dev
    let activePage = await this.selectSpseAccessIfNeeded(this.page);

    // Step 5: Tunggu sampai redirect ke SPSE / Auth0 role screen
    await activePage.waitForURL(url => !url.href.includes('account.eproc.dev/auth') && !url.href.includes('account.eproc.dev/redirect'), { timeout: 30000 }).catch(() => null);

    // Step 6: Bypass Security Key lagi jika muncul sebelum pilihan persona
    await this.bypassSecurityKey(activePage);

    // Step 7: pilih role hanya pada organisasi yang dikonfigurasi.
    await this.selectRole(activePage, {
      organization,
      role
    });

    await activePage.waitForURL(url => url.pathname.includes('/spse'), { timeout: 30000 }).catch(() => null);
    await activePage.waitForLoadState('domcontentloaded').catch(() => null);

    if (!await this.isAuthenticated(activePage, 30000)) {
      throw new Error(
        `Login PPK gagal. URL terakhir: ${activePage.url()}`
      );
    }
    this.page = activePage;
    return activePage;
  }

  async bypassSecurityKey(page) {
    const bypassButton = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i });
    for (let attempt = 0; attempt < 6; attempt++) {
      if (!await bypassButton.isVisible({ timeout: 6000 }).catch(() => false)) {
        break;
      }
      await captureGuideStep(page, {
        instruction: 'Klik Lanjutkan tanpa Security Key',
        target: bypassButton,
        expected: 'Halaman pemilihan role ditampilkan.'
      });
      await bypassButton.click({
        force: true,
        noWaitAfter: true
      });
      await page.waitForTimeout(1500);
      if (await bypassButton.isVisible().catch(() => false)) {
        await bypassButton.evaluate((button) => {
          button.click();
        });
        await page.waitForTimeout(2000);
      }
      if (await page.locator('button[id^="login-pesona-"]').first().isVisible({ timeout: 3000 }).catch(() => false)) {
        break;
      }
    }
  }

  async selectSpseAccessIfNeeded(page) {
    const accessLink = page.getByRole('link', { name: 'Manajemen Akses' });
    if (!await accessLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      return page;
    }

    await accessLink.click();
    await page.waitForTimeout(1000);

    const spseRow = page.getByRole('row', { name: /SPSE Staging.*Pilih/i }).or(
      page.locator('tr:has-text("SPSE Staging")')
    ).first();
    await spseRow.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await spseRow.locator('#select-application-btn, button:has-text("Pilih")').first().click();

    const nextButton = page.getByRole('button', {
      name: 'Selanjutnya',
      exact: true
    });
    const popupPromise = page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null);
    await nextButton.click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded').catch(() => null);
      return popup;
    }
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    return page;
  }

  async selectRole(page, { organization, role }) {
    await this.bypassSecurityKey(page);
    await page.waitForTimeout(1200);
    if (await this.isAuthenticated(page, 3000)) {
      return;
    }

    const roleButtons = page.locator('button[id^="login-pesona-"]');
    if (await roleButtons.first().isVisible({ timeout: 15000 }).catch(() => false)) {
      const organizationPattern = new RegExp(escapeRegExp(organization), 'i');
      const rolePattern = new RegExp(`\\b${escapeRegExp(role)}\\b`, 'i');
      const desiredRow = page.locator('tr')
        .filter({ hasText: organizationPattern, })
        .filter({ hasText: rolePattern, });
      const matchingRows = await desiredRow.count();
      if (matchingRows !== 1) {
        throw new Error(
          `Role ${role} untuk organisasi "${organization}" harus tepat satu, `
          + `aktual ${matchingRows}.`
        );
      }
      const desiredRole = desiredRow.locator(
        'button[id^="login-pesona-"]'
      ).first();

      if (await desiredRole.isVisible().catch(() => false)) {
        await captureGuideStep(page, {
          instruction: `Pilih role ${role} untuk ${organization}`,
          action: 'Pilih',
          target: desiredRole,
          expected: `Dashboard ${role} terbuka.`
        });
        await desiredRole.click();
      } else {
        throw new Error(
          `Tombol Masuk role ${role} untuk "${organization}" tidak tersedia.`
        );
      }
    }
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }

  async isAuthenticated(page = this.page, timeout = 30000) {
    const navigation = page.getByRole('link', { name: /DAFTAR PAKET/i }).first();
    try {
      await navigation.waitFor({
        state: 'visible',
        timeout
      });
      const ppkText = page.getByText(/PPK/i).first();
      await ppkText.waitFor({
        state: 'visible',
        timeout: Math.min(timeout, 10000)
      });
      return true;
    } catch {
      return false;
    }
  }
}

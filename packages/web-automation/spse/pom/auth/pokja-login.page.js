import { captureGuideStep } from '../../utils/guide-capture.js';

export class PokjaLoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  get actorLabel() {
    return 'Pokja';
  }

  async login({ username, password }, baseUrl) {
    if (!username || !password) {
      throw new Error('Kredensial Pokja belum dikonfigurasi.');
    }
    await this.page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const loginLink = this.page.locator(
      'a:has-text("LOGIN"), button:has-text("LOGIN")'
    ).first();
    if (await loginLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: `Klik LOGIN untuk masuk sebagai ${this.actorLabel}`,
        target: loginLink,
        expected: 'Halaman autentikasi ditampilkan.'
      });
      await loginLink.click();
    }

    await this.completeCredentials(username, password);
    await this.bypassSecurityKey(this.page);

    let activePage = await this.selectSpseAccessIfNeeded(this.page);
    const accessDenied = activePage.getByRole('heading', { name: /Akses Anda Ditolak/i });
    if (await accessDenied.isVisible({ timeout: 5000 }).catch(() => false)) {
      await activePage.getByRole('button', {
        name: 'Masuk',
        exact: true
      }).click();
      await activePage.waitForLoadState('domcontentloaded').catch(() => null);
      this.page = activePage;

      const retryLoginLink = activePage.locator(
        'a:has-text("LOGIN"), button:has-text("LOGIN")'
      ).first();
      if (await retryLoginLink.isVisible({ timeout: 10000 }).catch(() => false)) {
        await retryLoginLink.click();
        await activePage.waitForLoadState('domcontentloaded').catch(() => null);
      }

      await this.completeCredentials(username, password);
      await this.bypassSecurityKey(activePage);
      activePage = await this.selectSpseAccessIfNeeded(activePage);
    }
    await this.bypassSecurityKey(activePage);
    await this.selectPokjaRole(activePage);

    if (!await this.isAuthenticated(activePage)) {
      throw new Error(
        `Login ${this.actorLabel} gagal. URL terakhir: ${activePage.url()}`
      );
    }
    this.page = activePage;
    return activePage;
  }

  async completeCredentials(username, password) {
    const emailInput = this.page.getByRole(
      'textbox',
      { name: 'Alamat email' }
    );
    if (!await emailInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      return;
    }
    await captureGuideStep(this.page, {
      instruction: 'Isi Alamat email anggota Pokja',
      action: 'Isi',
      target: emailInput,
      expected: 'Email siap diproses.'
    });
    await emailInput.fill(username);
    await this.page.getByRole('button', {
      name: 'Lanjut',
      exact: true
    }).click({ noWaitAfter: true });

    const passwordInput = this.page.getByRole(
      'textbox',
      { name: 'Sandi' }
    );
    await passwordInput.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Isi Sandi anggota Pokja',
      action: 'Isi',
      target: passwordInput,
      expected: 'Sandi tersimpan secara tersensor.'
    });
    await passwordInput.fill(password);
    await this.page.getByRole('button', {
      name: 'Lanjut',
      exact: true
    }).click({ noWaitAfter: true });
    await this.page.waitForTimeout(2000);
  }

  async bypassSecurityKey(page) {
    const bypassButton = page.locator(
      'button:has-text("Lanjutkan tanpa Security Key"), a:has-text("Lanjutkan tanpa Security Key")'
    ).first();
    for (let attempt = 0; attempt < 8; attempt++) {
      if (!await bypassButton.isVisible({ timeout: 15000 }).catch(() => false)) {
        break;
      }
      await captureGuideStep(page, {
        instruction: 'Klik Lanjutkan tanpa Security Key',
        target: bypassButton,
        expected: `Proses login ${this.actorLabel} berlanjut.`
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
        await page.waitForTimeout(2500);
      }
    }
  }

  async selectSpseAccessIfNeeded(page) {
    const accessLink = page.getByRole('link', { name: 'Manajemen Akses' });
    if (!await accessLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return page;
    }

    await accessLink.click();
    const spseRow = page.getByRole('row', { name: /SPSE Staging.*Pilih/i });
    await spseRow.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await spseRow.locator('#select-application-btn').click();

    const nextButton = page.getByRole('button', {
      name: 'Selanjutnya',
      exact: true
    });
    const popupPromise = page.waitForEvent('popup', { timeout: 15000 }).catch(() => null);
    await nextButton.click();
    const popup = await popupPromise;
    if (!popup) {
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      return page;
    }
    await popup.waitForLoadState('domcontentloaded').catch(() => null);
    return popup;
  }

  async selectPokjaRole(page) {
    // The Security Key interstitial can appear after the access-selection
    // redirect has already completed, so check once more before finding roles.
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
        if (context.includes('anggota pokja pemilihan')
          && context.includes('kota cirebon')) {
          return button.id;
        }
      }
      return null;
    }).catch(() => null);

    if (desiredRoleId) {
      await captureGuideStep(page, {
        instruction: 'Pilih role Anggota Pokja Pemilihan Kota Cirebon',
        action: 'Pilih',
        target: page.locator(`#${desiredRoleId}`),
        expected: 'Dashboard Pokja terbuka.'
      });
      await page.locator(`#${desiredRoleId}`).click();
    } else {
      const fallback = page.locator(
        '#login-pesona-6-btn, #login-pesona-7-btn'
      ).first();
      if (!await fallback.isVisible({ timeout: 20000 }).catch(() => false)) {
        const pageText = (await page.locator('body').innerText())
          .replace(/\s+/g, ' ').trim().slice(0, 500);
        throw new Error(
          `Pilihan role Pokja tidak tersedia. URL: ${page.url()}. `
          + `Halaman: ${pageText}`
        );
      }
      await fallback.click();
    }
    await page.waitForLoadState('domcontentloaded').catch(() => null);
  }

  async isAuthenticated(page, timeout = 30000) {
    const navigation = page.getByRole('link', { name: /DAFTAR PAKET/i }).first();
    if (!await navigation.isVisible({ timeout }).catch(() => false)) {
      return false;
    }
    return page.getByText(
      /POKJA\s*-\s*Kota Cirebon/i
    ).first().isVisible({ timeout: 10000 }).catch(() => false);
  }
}

import { FormPaketPage } from './form-paket.page.js';
import { captureGuideStep } from '../../utils/guide-capture.js';

export class NonTenderPage extends FormPaketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
  }

  getActivePage() {
    const pages = this.page.context().pages();
    for (let index = pages.length - 1; index >= 0; index--) {
      const candidate = pages[index];
      if (
        /\/spse\/paketnontender\/[^/?]+\/edit(?:\?|$)/.test(candidate.url())
        || candidate.url().includes('paketplctr')
        || candidate.url().includes('rencananontender')
        || candidate.url().includes('/spse/paketnontender')
        || candidate.url().includes('/spse/paket')
        || candidate.url().includes('/spse/home')
      ) {
        this.page = candidate;
        return candidate;
      }
    }
    return this.page;
  }

  async handleInaprocSsoIfNeeded(username, password, targetPage = null) {
    const page = targetPage || this.getActivePage();
    for (let i = 0; i < 15; i++) {
      const url = page.url();
      if (url.includes('/spse/rencananontender') || url.includes('/spse/paketnontender/tambah')) {
        return;
      }

      if (url.includes('accounts.inaproc.id') || url.includes('register-spa') || url.includes('/u/login')) {
        const user = username || process.env.SPSE_PPK_USERNAME;
        const pass = password || process.env.SPSE_PPK_PASSWORD;
        if (!user || !pass) {
          throw new Error('SPSE PPK credentials are required through arguments or environment variables.');
        }

        const emailInput = page.locator('input[name="email"], input[name="username"], input[placeholder*="namapengguna" i], input[type="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await emailInput.fill(user);
          await emailInput.dispatchEvent('input').catch(() => null);
          await emailInput.dispatchEvent('change').catch(() => null);
          await page.waitForTimeout(1000);
          const submitBtn = page.locator('#login-btn, button[type="submit"], button:has-text("Masuk"), button:has-text("Lanjut")').first();
          await submitBtn.click({ force: true });
          await page.waitForTimeout(2500);
        }

        const passInput = page.locator('input[name="password"], input[type="password"]').first();
        if (await passInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await passInput.fill(pass);
          await passInput.dispatchEvent('input').catch(() => null);
          await passInput.dispatchEvent('change').catch(() => null);
          await page.waitForTimeout(500);
          const passSubmit = page.locator('button[type="submit"], button:has-text("Lanjut")').first();
          await passSubmit.click({ force: true });
          await page.waitForTimeout(2500);
        }

        const bypassBtn = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i });
        if (await bypassBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bypassBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }

      if (url.includes('account.eproc.dev')) {
        const accessLink = page.getByRole('link', { name: 'Manajemen Akses' });
        if (await accessLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await accessLink.click();
          await page.waitForTimeout(1000);
        }

        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
          const spseModalBtn = modal.locator('tr').filter({ hasText: /SPSE Staging/i }).locator('button').first();
          if (await spseModalBtn.isVisible().catch(() => false)) {
            await spseModalBtn.click();
            await page.waitForTimeout(1500);
          }
        } else {
          const cirebonRow = page.locator('tr').filter({ hasText: /KOTA CIREBON/i }).first();
          if (!await cirebonRow.isVisible({ timeout: 2000 }).catch(() => false)) {
            const dropdown = page.locator('input[placeholder*="Pilih"], [role="combobox"]').first();
            if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
              await dropdown.click();
              await page.waitForTimeout(1000);
              const spseModalBtn = page.locator('[role="dialog"]').locator('tr').filter({ hasText: /SPSE Staging/i }).locator('button').first();
              if (await spseModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await spseModalBtn.click();
                await page.waitForTimeout(1500);
              }
            }
          }
        }

        const cirebonRow = page.locator('tr').filter({ hasText: /KOTA CIREBON/i }).first();
        if (await cirebonRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          await cirebonRow.click({ force: true });
          await page.waitForTimeout(1000);
          const selBtn = page.getByRole('button', {
            name: 'Selanjutnya',
            exact: true
          }).or(
            page.locator('button:has-text("Selanjutnya")')
          ).first();
          if (await selBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            const popupPromise = page.context().waitForEvent('page', { timeout: 15000, }).catch(() => null);
            await selBtn.click({ force: true });
            const popup = await popupPromise;
            if (popup) {
              await popup.waitForLoadState('domcontentloaded').catch(() => null);
              this.page = popup;
              return this.handleInaprocSsoIfNeeded(
                username,
                password,
                popup
              );
            }
            await page.waitForTimeout(3000);
          }
        }
      }

      const bypassKey = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i });
      if (await bypassKey.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bypassKey.click({ force: true });
        await page.waitForTimeout(2000);
      }

      // Setelah memilih platform, UI terbaru menampilkan satu tahap tambahan
      // berisi daftar akses dan tombol Masuk sebelum halaman persona SPSE.
      const ppkAccessRow = page.locator('tr').filter({ hasText: /DINAS PERHUBUNGAN/i, }).filter({ hasText: /PPK/i, }).first();
      const enterAccessButton = ppkAccessRow.getByRole('button', {
        name: 'Masuk',
        exact: true,
      }).or(ppkAccessRow.getByRole('link', {
        name: 'Masuk',
        exact: true,
      })).first();
      if (await enterAccessButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await enterAccessButton.click({ force: true });
        await page.waitForLoadState('domcontentloaded').catch(() => null);
        await page.waitForTimeout(2000);
      }

      const roleBtn = page.locator('button[id^="login-pesona-"]').filter({ hasText: /PPK/i }).or(page.locator('#login-pesona-5-btn')).first();
      if (await roleBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await roleBtn.click({ force: true });
        await page.waitForTimeout(3000);
      }

      await page.waitForTimeout(1000);
    }
  }

  async navigateToBuatPaket(username, password, retryAfterLogin = 0) {
    const page = this.getActivePage();
    await page.bringToFront().catch(() => null);
    await page.waitForLoadState('domcontentloaded').catch(() => null);

    const daftarPaketLink = page.getByRole('link', { name: /DAFTAR PAKET/i }).first();
    const nonTenderLink = page.getByRole('link', { name: 'Non Tender' }).first();
    const buatPaketLink = page.getByRole('link', { name: 'Buat Paket' }).first();

    // 1. Klik DAFTAR PAKET
    await daftarPaketLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(page, {
      instruction: 'Buka menu navigasi DAFTAR PAKET',
      target: daftarPaketLink,
      expected: 'Menu dropdown paket tampil.'
    });
    await daftarPaketLink.click();
    await page.waitForTimeout(1000);
    // 2. Klik Non Tender
    await nonTenderLink.waitFor({
      state: 'visible',
      timeout: 20000
    });
    await captureGuideStep(page, {
      instruction: 'Klik tab Non Tender',
      target: nonTenderLink,
      expected: 'Daftar paket Non Tender ditampilkan.'
    });
    await nonTenderLink.click();
    await page.waitForTimeout(1000);
    // 3. Klik Buat Paket
    await buatPaketLink.waitFor({
      state: 'visible',
      timeout: 20000
    });
    await captureGuideStep(page, {
      instruction: 'Klik Buat Paket',
      target: buatPaketLink,
      expected: 'Form pemilihan RUP terbuka.'
    });
    await buatPaketLink.click();
    await page.waitForTimeout(2000);
    // 4. Handle re-authentication if intercepted by INAPROC/Pomerium
    await this.handleInaprocSsoIfNeeded(username, password);

    const activePage = this.getActivePage();
    let activeUrl = new URL(activePage.url());
    if (activeUrl.hostname !== 'pengadaan-stg-2.eproc.dev') {
      await activePage.goto('https://pengadaan-stg-2.eproc.dev/spse/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      activeUrl = new URL(activePage.url());
      if (activeUrl.hostname !== 'pengadaan-stg-2.eproc.dev') {
        throw new Error(
          `Gagal mengoreksi redirect login ulang ke SPSE 2. URL: ${activePage.url()}`
        );
      }
    }
    const formIsOpen = activeUrl.pathname.includes('/spse/rencananontender')
      || activeUrl.pathname.includes('/spse/paketnontender/tambah');
    if (!formIsOpen && retryAfterLogin < 2) {
      return this.navigateToBuatPaket(
        username,
        password,
        retryAfterLogin + 1
      );
    }
    if (!formIsOpen) {
      throw new Error(
        `Form Buat Paket tidak terbuka setelah login ulang. URL: ${activePage.url()}`
      );
    }
  }

  async selectSatkerAndMetode({
    tahun,
    satkerQuery,
    metodeLabel,
    jenisPengadaanLabel,
  }) {
    const page = this.getActivePage();
    const tahunSelect = page.locator('#tahun, select[name="tahun"]').first();
    const satkerSelect = page.locator(
      '#satker, #satkerId, select[name="satkerId"]'
    ).first();
    const metodeSelect = page.locator(
      '#metodepemilihan, #metodePemilihan, select[name="metodePemilihan"]'
    ).first();
    const jenisSelect = page.locator(
      '#jenisId, #jenisPengadaan, select[name="jenisId"], select[name="jenisPengadaan"]'
    ).first();

    if (tahun && await tahunSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tahunSelect.selectOption(tahun, { force: true }).catch(() => null);
      await page.waitForTimeout(500);
    }

    await satkerSelect.locator('option').filter({ hasText: satkerQuery }).first().waitFor({
      state: 'attached',
      timeout: 30000
    });
    await captureGuideStep(page, {
      instruction: `Pilih Satuan Kerja ${satkerQuery}`,
      action: 'Pilih',
      target: satkerSelect,
      expected: 'RUP difilter untuk satuan kerja tersebut.'
    });
    await satkerSelect.selectOption(
      { label: satkerQuery },
      { force: true }
    );
    await satkerSelect.dispatchEvent('change');
    await page.waitForTimeout(800);

    await metodeSelect.locator('option').filter({ hasText: metodeLabel }).first().waitFor({
      state: 'attached',
      timeout: 30000
    });
    await captureGuideStep(page, {
      instruction: `Pilih Metode Pemilihan ${metodeLabel}`,
      action: 'Pilih',
      target: metodeSelect,
      expected: 'Tabel hanya menampilkan RUP dengan metode yang sesuai.'
    });
    await metodeSelect.selectOption(
      { label: metodeLabel },
      { force: true }
    );
    await metodeSelect.dispatchEvent('change');
    await page.waitForTimeout(800);

    if (jenisPengadaanLabel) {
      await jenisSelect.locator('option').filter({ hasText: jenisPengadaanLabel }).first().waitFor({
        state: 'attached',
        timeout: 10000
      }).catch(() => null);
      await captureGuideStep(page, {
        instruction: `Pilih Jenis Pengadaan ${jenisPengadaanLabel}`,
        action: 'Pilih',
        target: jenisSelect,
        expected: 'Jenis pengadaan paket terpilih.'
      });
      await jenisSelect.selectOption(
        { label: jenisPengadaanLabel },
        { force: true }
      ).catch(() => null);
      await jenisSelect.dispatchEvent('change').catch(() => null);
      await page.waitForTimeout(800);
    }

    await page.locator('table tbody tr').first().waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async selectRencanaAndCreatePaket({
    rupName, rupIndex, metodeLabel, minimumPagu
  }) {
    const page = this.getActivePage();

    const candidateRows = page.locator('table tbody tr').filter({
      has: page.locator(
        'input[type="checkbox"]:not([disabled]), .dt-checkboxes'
      )
    }).filter({ hasText: metodeLabel });

    await candidateRows.first().waitFor({
      state: 'visible',
      timeout: 30000
    }).catch(async () => {
      const visibleRows = await page.locator('table tbody tr')
        .allTextContents();
      throw new Error(
        `Tidak ada RUP dengan metode "${metodeLabel}". Baris yang tampil: ${visibleRows.join(' | ')}`
      );
    });

    let targetRow = candidateRows.first();
    let selectedPagu = null;
    if (rupName) {
      targetRow = candidateRows.filter({ hasText: rupName }).first();
    } else if (minimumPagu) {
      const count = await candidateRows.count();
      for (let index = 0; index < count; index++) {
        const candidate = candidateRows.nth(index);
        const text = (await candidate.textContent()) || '';
        const currencyValues = [...text.matchAll(
          /Rp\.?\s*([\d.]+(?:,\d+)?)\s*(Jt|M)?/gi
        )].map((match) => {
          const value = Number(
            match[1].replace(/\./g, '').replace(',', '.')
          );
          const multiplier = match[2]?.toLowerCase() === 'm'
            ? 1_000_000_000
            : match[2]?.toLowerCase() === 'jt'
              ? 1_000_000
              : 1;
          return value * multiplier;
        });
        const pagu = Math.max(0, ...currencyValues);
        if (pagu > minimumPagu) {
          targetRow = candidate;
          selectedPagu = pagu;
          break;
        }
      }
      if (selectedPagu === null) {
        throw new Error(
          `Tidak ada RUP dengan pagu di atas Rp${minimumPagu.toLocaleString('id-ID')}.`
        );
      }
    } else if (typeof rupIndex === 'number') {
      targetRow = candidateRows.nth(rupIndex);
    }

    await targetRow.waitFor({
      state: 'visible',
      timeout: 15000
    });
    const rowText = (await targetRow.textContent())?.replace(/\s+/g, ' ').trim();
    const checkbox = targetRow.locator(
      'input[type="checkbox"]:not([disabled]), .dt-checkboxes'
    ).first();

    await captureGuideStep(page, {
      instruction: `Pilih checkbox RUP: ${rowText?.slice(0, 50)}...`,
      action: 'Pilih',
      target: checkbox,
      expected: 'RUP terpilih untuk dibuat menjadi paket.'
    });
    await checkbox.check({ force: true });
    await page.waitForTimeout(500);

    const buatPaketActionBtn = page.locator(
      '#buatPaket, button:has-text("Buat Paket"), input[value*="Buat Paket"]'
    ).first();
    await buatPaketActionBtn.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await buatPaketActionBtn.click();
    await page.waitForLoadState('domcontentloaded').catch(() => null);

    return {
      nama: rupName || rowText || 'Paket Non Tender',
      metodeLabel,
      pagu: selectedPagu,
    };
  }
}

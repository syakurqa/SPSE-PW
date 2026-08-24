import { captureGuideStep } from '../../utils/guide-capture.js';

export class ProviderPackagePage {
  constructor(page) {
    this.page = page;
  }

  async waitForPackageTableReady(previousSignature = null) {
    const processing = this.page.locator(
      '.dataTables_processing:visible, [id$="_processing"]:visible'
    ).first();
    if (await processing.isVisible({ timeout: 1000 }).catch(() => false)) {
      await processing.waitFor({
        state: 'hidden',
        timeout: 30000
      });
    }

    await this.page.waitForFunction(({ previous }) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      if (rows.length === 0) {
        return false;
      }
      const signature = rows.map((row) => (
        row.textContent || ''
      )).join('|').replace(/\s+/g, ' ').trim();
      return signature.length > 0 && (!previous || signature !== previous);
    }, { previous: previousSignature }, { timeout: 30000 });
  }

  async currentTableSignature() {
    return this.page.locator('table tbody tr').evaluateAll((rows) => (
      rows.map((row) => row.textContent || '').join('|')
        .replace(/\s+/g, ' ')
        .trim()
    ));
  }

  async openNonTenderPackage(manifest) {
    return this.openAvailableNonTenderPackage(manifest);
  }

  async openAvailableNonTenderPackage(manifest) {
    const packageMenu = this.page.getByRole('link', { name: /DAFTAR PAKET|PAKET BARU/i, }).first();
    await captureGuideStep(this.page, {
      instruction: 'Klik DAFTAR PAKET atau PAKET BARU',
      target: packageMenu,
      expected: 'Daftar paket yang tersedia bagi Penyedia terbuka.',
    });
    await this.openNonTenderList(packageMenu);
    await this.openPackageFromCurrentList(manifest, { expected: 'Detail dan Pakta Integritas paket ditampilkan.', });
  }

  async openAcceptedNonTenderPackageFromHome(manifest) {
    const homeMenu = this.page.getByRole('link', {
      name: 'BERANDA',
      exact: true,
    }).first();
    await captureGuideStep(this.page, {
      instruction: 'Klik BERANDA untuk membuka paket yang telah diikuti',
      target: homeMenu,
      expected: 'Beranda dan daftar paket yang diikuti Penyedia terbuka.',
    });
    await this.openNonTenderList(homeMenu);
    await this.openPackageFromCurrentList(manifest, { expected: 'Detail paket yang telah diikuti Penyedia ditampilkan.', });
  }

  async openNonTenderList(menuLink) {
    await menuLink.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);

    const nonTenderTab = this.page.getByRole('link', {
      name: 'Non Tender',
      exact: true,
    }).or(this.page.getByText('Non Tender', { exact: true })).first();
    await captureGuideStep(this.page, {
      instruction: 'Pilih tab Non Tender',
      target: nonTenderTab,
      expected: 'Tabel paket Non Tender ditampilkan.',
    });
    await nonTenderTab.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.waitForPackageTableReady();
  }

  async openPackageFromCurrentList(manifest, { expected }) {
    const search = this.page.locator(
      'input[type="search"], input[placeholder*="Cari" i]'
    ).first();
    if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
      const previousSignature = await this.currentTableSignature();
      await search.fill(manifest.procurementPackageId || manifest.packageName);
      await this.waitForPackageTableReady(previousSignature).catch(async () => {
        // Sebagian versi DataTables tidak mengganti isi bila hanya ada satu
        // hasil. Dalam kondisi itu cukup pastikan baris paket sudah tampil.
        await this.packageRowsMatching(manifest).first().waitFor({
          state: 'visible',
          timeout: 30000,
        });
      });
    }

    const packageRow = await this.findPackageRowAcrossPages(manifest);
    const packageLink = packageRow.locator(
      'a[href*="/spse/nontender/"]'
    ).filter({ hasText: manifest.packageName }).or(
      packageRow.locator('a[href*="/spse/nontender/"]')
    ).first();
    await packageLink.waitFor({
      state: 'visible',
      timeout: 10000
    });
    await captureGuideStep(this.page, {
      instruction: `Buka paket ${manifest.packageName}`,
      target: packageLink,
      expected,
    });
    await packageLink.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
  }

  async findPackageRowAcrossPages(manifest) {
    for (let pageNumber = 1; pageNumber <= 10; pageNumber++) {
      const packageRow = this.packageRowsMatching(manifest).first();
      if (await packageRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        return packageRow;
      }

      const nextPage = this.page.getByRole('link', { name: /^(?:›|>|Next|Berikut)$/i, }).or(this.page.locator(
        'a[aria-label*="Next" i], .pagination a:has-text("›")'
      )).last();
      if (!await nextPage.isVisible({ timeout: 2000 }).catch(() => false)) {
        break;
      }
      const disabled = await nextPage.getAttribute('class');
      if (/disabled/i.test(disabled || '')) {
        break;
      }
      const previousSignature = await this.currentTableSignature();
      await nextPage.click();
      await this.waitForPackageTableReady(previousSignature);
    }
    throw new Error(
      `Paket ${manifest.packageName} tidak ditemukan pada daftar Non Tender Penyedia.`
    );
  }

  packageRowsMatching(manifest) {
    const rows = this.page.locator('table tbody tr');
    const packageMarker = manifest.procurementPackageId || manifest.packageId;
    return rows.filter({ hasText: manifest.packageName }).or(
      rows.filter({ hasText: packageMarker })
    );
  }

  async acceptPackage() {
    const acceptButton = this.page.getByRole('button', { name: /Setuju\s*&\s*(?:Ikut|Terima) Paket/i, }).or(this.page.getByRole('link', { name: /Setuju\s*&\s*(?:Ikut|Terima) Paket/i, })).first();
    await acceptButton.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Setuju & Ikut Paket',
      target: acceptButton,
      expected: 'Penyedia menyetujui Pakta Integritas dan menerima paket.',
    });
    await acceptButton.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);

    const bodyText = (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (!/berhasil|telah mengikuti|paket diikuti|paket yang anda ikuti/i.test(bodyText)) {
      const buttonStillVisible = await acceptButton.isVisible().catch(() => false);
      if (buttonStillVisible) {
        throw new Error('Paket belum berhasil diterima oleh Penyedia.');
      }
    }
  }

  async verifyPackageOnHome(manifest) {
    const homeLink = this.page.getByRole('link', {
      name: 'BERANDA',
      exact: true,
    }).first();
    await captureGuideStep(this.page, {
      instruction: 'Kembali ke Beranda setelah menerima paket',
      target: homeLink,
      expected: 'Beranda Penyedia dan daftar Paket Untuk Anda ditampilkan.',
    });
    await homeLink.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);

    const nonTenderTab = this.page.getByRole('link', {
      name: 'Non Tender',
      exact: true,
    }).or(this.page.getByText('Non Tender', { exact: true })).first();
    if (await nonTenderTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nonTenderTab.click();
    }

    const search = this.page.locator(
      'input[type="search"], input[placeholder*="Cari" i]'
    ).first();
    if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
      const previousSignature = await this.currentTableSignature();
      await search.fill(manifest.procurementPackageId || manifest.packageName);
      await this.waitForPackageTableReady(previousSignature).catch(async () => {
        await this.packageRowsMatching(manifest).first().waitFor({
          state: 'visible',
          timeout: 30000,
        });
      });
    }

    const packageEntry = await this.findPackageRowAcrossPages(manifest);
    await captureGuideStep(this.page, {
      instruction: 'Pastikan paket yang disetujui muncul di Beranda',
      action: 'Validasi',
      target: packageEntry,
      expected: 'Paket tercantum pada daftar Non Tender di Beranda Penyedia.',
    });
    return true;
  }
}

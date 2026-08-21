import { captureGuideStep } from '../../utils/guide-capture.js';

export class ProviderPackagePage {
  constructor(page) {
    this.page = page;
  }

  async openNonTenderPackage(manifest) {
    const packageMenu = this.page.getByRole('link', {
      name: 'BERANDA',
      exact: true,
    }).first();
    await captureGuideStep(this.page, {
      instruction: 'Klik Beranda',
      target: packageMenu,
      expected: 'Beranda dan daftar paket yang diikuti Penyedia terbuka.',
    });
    await packageMenu.click();
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

    const search = this.page.locator(
      'input[type="search"], input[placeholder*="Cari" i]'
    ).first();
    if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
      await search.fill(manifest.procurementPackageId || manifest.packageName);
      await this.page.waitForTimeout(1000);
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
      expected: 'Detail dan Pakta Integritas paket ditampilkan.',
    });
    await packageLink.click();
  }

  async findPackageRowAcrossPages(manifest) {
    const packageMarker = manifest.procurementPackageId || manifest.packageId;
    for (let pageNumber = 1; pageNumber <= 10; pageNumber++) {
      const packageRow = this.page.locator('table tbody tr').filter({ hasText: manifest.packageName, }).or(this.page.locator('table tbody tr').filter({ hasText: packageMarker, })).first();
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
      await nextPage.click();
      await this.page.waitForTimeout(1000);
    }
    throw new Error(
      `Paket ${manifest.packageName} tidak ditemukan pada Beranda Penyedia.`
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
      await search.fill(manifest.procurementPackageId || manifest.packageName);
      await this.page.waitForTimeout(1000);
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

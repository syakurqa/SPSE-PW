import { NonTenderPage } from './non-tender.page.js';

export class TenderPage extends NonTenderPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
  }

  async navigateToBuatPaket() {
    const page = this.getActivePage();
    const daftarPaketLink = page.getByRole('link', {
      name: 'DAFTAR PAKET',
      exact: true
    });
    const tenderLink = page.getByRole('link', {
      name: 'Tender',
      exact: true
    });
    const buatPaketLink = page.getByRole('link', {
      name: 'Buat Paket',
      exact: true
    });

    await daftarPaketLink.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await daftarPaketLink.click();
    await tenderLink.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await tenderLink.click();
    await buatPaketLink.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await buatPaketLink.click();
    await page.waitForLoadState('domcontentloaded');
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

    await tahunSelect.selectOption(tahun, { force: true });
    await satkerSelect.locator('option').filter({ hasText: satkerQuery }).first().waitFor({
      state: 'attached',
      timeout: 30000
    });
    await satkerSelect.selectOption(
      { label: satkerQuery },
      { force: true }
    );
    await satkerSelect.dispatchEvent('change');
    await metodeSelect.locator('option').filter({ hasText: metodeLabel }).first().waitFor({
      state: 'attached',
      timeout: 30000
    });
    await metodeSelect.selectOption(
      { label: metodeLabel },
      { force: true }
    );
    await metodeSelect.dispatchEvent('change');

    if (jenisPengadaanLabel) {
      await jenisSelect.selectOption(
        { label: jenisPengadaanLabel },
        { force: true }
      );
      await jenisSelect.dispatchEvent('change');
    }

    const selectedSatker = (await satkerSelect
      .locator('option:checked').textContent())?.trim();
    const selectedMethod = (await metodeSelect
      .locator('option:checked').textContent())?.trim();
    if (selectedSatker !== satkerQuery || selectedMethod !== metodeLabel) {
      throw new Error(
        `Filter Tender tidak sesuai fixture. Satker: "${selectedSatker}", metode: "${selectedMethod}".`
      );
    }

    await page.getByText('Update RUP', { exact: true }).first().click();
    await page.waitForTimeout(3000);
  }
}

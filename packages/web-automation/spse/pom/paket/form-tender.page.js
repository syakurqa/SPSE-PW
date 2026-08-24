import path from 'path';
import { FormPaketPage } from './form-paket.page.js';

export class FormTenderPage extends FormPaketPage {
  getActivePage() {
    const pages = this.page.context().pages();
    const editPage = pages.filter((candidate) =>
      /\/spse\/paket\/[^/?]+\/edit/.test(candidate.url())
    ).at(-1);
    return editPage || (
      pages.length > 0 ? pages[pages.length - 1] : this.page
    );
  }

  async uploadModalDokumen(linkName, absPath, submitAction) {
    const page = this.getActivePage();
    const documentLink = page.getByRole('link', { name: linkName });
    const partialUrl = await documentLink.getAttribute('href');
    const packageId = partialUrl?.match(/\/dokumen\/([^/]+)\//)?.[1];
    if (!packageId) {
      throw new Error(
        `ID paket Tender tidak ditemukan dari link dokumen: ${partialUrl}`
      );
    }

    const fileName = path.basename(absPath);
    const documentUrl = new URL(partialUrl, page.url()).toString();
    const partialResponse = await page.request.get(documentUrl);
    const currentDocuments = await partialResponse.text();
    if (partialResponse.ok() && currentDocuments.includes(fileName)) {
      return;
    }

    await this.uploadSignedFile({
      page,
      packageId,
      absPath,
      saveUrl: `${new URL(page.url()).origin}/spse/dokumen/${packageId}/${submitAction}`,
      authorize: true,
      authorizationPath: 'otorisasiDataPaketUpload',
    });
  }

  async selectKepalaUkpbjAndSubmit(filePath) {
    const page = this.getActivePage();
    await page.bringToFront().catch(() => null);

    const missingUkpbjWarning = page.getByText(
      /Silakan pilih Kepala UKPBJ terlebih dahulu/i
    );
    if (await missingUkpbjWarning.isVisible().catch(() => false)) {
      const pilihUkpbjLink = page.getByRole('link', { name: /Pilih Kepala UKPBJ/i }).first();
      await pilihUkpbjLink.waitFor({
        state: 'visible',
        timeout: 10000
      });
      await pilihUkpbjLink.click();
      await page.waitForLoadState('domcontentloaded');

      const pilihKepalaBtn = page.getByRole('link', {
        name: 'Pilih',
        exact: true
      }).first();
      await pilihKepalaBtn.waitFor({
        state: 'visible',
        timeout: 15000
      });
      await pilihKepalaBtn.click();
      await page.getByText(/Nota Dinas PPK/).first().waitFor({
        state: 'visible',
        timeout: 30000
      });
    }

    if (await missingUkpbjWarning.isVisible().catch(() => false)) {
      throw new Error(
        'Kepala UKPBJ belum tersimpan setelah tombol Pilih diklik.'
      );
    }

    const packageId = page.url().match(/\/paket\/([^/?]+)/)?.[1];
    if (!packageId) {
      throw new Error(
        `ID paket Tender Step 3 tidak ditemukan dari URL: ${page.url()}`
      );
    }
    const existingAttachment = page.getByText(
      path.basename(filePath),
      { exact: false }
    );
    if (!await existingAttachment.isVisible().catch(() => false)) {
      await this.uploadSignedFile({
        page,
        packageId,
        absPath: filePath,
        saveUrl: `${new URL(page.url()).origin}/spse/paket/${packageId}/uploadAttachment`,
        extraForm: { step: 1 },
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    const kirimEmailBtn = page.locator(
      '#kirimEmailPokja:visible, #kirimEmailPp:visible, button:has-text("Kirim Email"):visible'
    ).first();
    const emailAlreadySent = page.getByText(
      'Sudah dikirim',
      { exact: false }
    ).first();
    if (!await emailAlreadySent.isVisible().catch(() => false)) {
      await kirimEmailBtn.waitFor({
        state: 'visible',
        timeout: 60000
      });
      await kirimEmailBtn.click();

      const confirmBtn = page.locator(
        '.bootstrap-dialog-footer-buttons button:has-text("OK"), .bootstrap-dialog-footer-buttons button:has-text("Ya"), .modal-dialog button:has-text("OK")'
      ).last();
      await confirmBtn.waitFor({
        state: 'visible',
        timeout: 10000
      });
      await confirmBtn.click();
      await emailAlreadySent.waitFor({
        state: 'visible',
        timeout: 30000
      });
    }

    const simpanBuatPaketBtn = page.locator(
      '#simpan, button:has-text("Simpan dan Membuat Paket")'
    ).first();
    await simpanBuatPaketBtn.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await simpanBuatPaketBtn.scrollIntoViewIfNeeded();
    await simpanBuatPaketBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.getByText(
      /Data Paket berhasil tersimpan/i
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
  }
}

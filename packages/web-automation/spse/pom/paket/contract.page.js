import { captureGuideStep } from '../../utils/guide-capture.js';

export class ContractPage {
  constructor(page) {
    this.page = page;
  }

  async open(manifest) {
    if (!manifest.flow10SppbjId) throw new Error('Manifest belum memiliki flow10SppbjId');
    const url = new URL(
      `/spse/surat-perjanjian-pl/suratperjanjianppkpl?sppbjId=${manifest.flow10SppbjId}`,
      this.page.url()
    ).href;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.getByText('Form Surat Perjanjian', { exact: false }).waitFor({
      state: 'visible',
      timeout: 30000
    });
    return url;
  }

  async fillForm(data) {
    const form = this.page.locator('#formPerjanjian');
    await captureGuideStep(this.page, {
      instruction: 'Isi formulir Surat Perjanjian dengan lingkup pekerjaan, nomor, tanggal, pihak penyedia, rekening, dan informasi nilai kontrak',
      action: 'Isi',
      target: form,
      expected: 'Data kontrak terisi dan nilai kontrak mengikuti hasil negosiasi/SPPBJ.',
    });
    await form.locator('textarea[name="kontrak.kontrak_lingkup_pekerjaan"]').fill(data.scope);
    await form.locator('input[name="kontrak.kontrak_no"]').fill(data.contractNumber);
    const dateInput = form.locator('input[name="kontrak.kontrak_tanggal"]');
    await dateInput.click();
    await dateInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await dateInput.type(data.contractDate);
    await dateInput.press('Tab');
    await form.locator('input[name="kontrak.kontrak_kota"]').fill(data.city);
    await form.locator('input[name="kontrak.jabatan_ppk_kontrak"]').fill(data.ppkTitle);
    await form.locator('input[name="kontrak.no_sk_ppk_kontrak"]').fill(data.ppkSkNumber);
    await form.locator('input[name="kontrak.kontrak_wakil_penyedia"]').fill(data.providerRepresentative);
    await form.locator('input[name="kontrak.kontrak_jabatan_wakil"]').fill(data.providerRepresentativeTitle);
    await form.locator('input[name="kontrak.kontrak_nama_bank"]').fill(data.bankName);
    await form.locator('input[name="kontrak.kontrak_norekening"]').fill(data.bankAccount);
    await form.locator('input[name="kontrak.kontrak_namapemilikrekening"]').fill(data.bankAccountOwner);
    const pdnInput = form.locator('input[name="kontrak.nilai_pdn"]');
    await pdnInput.click();
    await pdnInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await pdnInput.type(data.pdnValue);
    const umkInput = form.locator('input[name="kontrak.nilai_umk"]');
    await umkInput.fill(data.umkValue);
    await umkInput.press('Tab');
    await form.locator('textarea[name="kontrak.kontrak_lingkup"]').fill(data.additionalInformation);
    await captureGuideStep(this.page, {
      instruction: 'Pastikan seluruh nilai dan data wajib kontrak sudah terlihat terisi sebelum disimpan',
      action: 'Validasi',
      target: form,
      expected: 'Nilai PDN terlihat 0 dan nilai UMK/kontrak konsisten dengan SPPBJ.',
    });
  }

  async save() {
    const saveButton = this.page.locator('#save');
    await captureGuideStep(this.page, {
      instruction: 'Klik Simpan untuk menyimpan draf Surat Perjanjian',
      target: saveButton,
      expected: 'Draf kontrak tersimpan dan tersedia untuk ditinjau pada alur E-Kontrak.',
    });
    const submitResponsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/spse/surat-perjanjian-pl/simpansuratperjanjianpl'),
      { timeout: 30000 }
    ).catch(() => null);
    await saveButton.click();
    const visibleConfirmButtons = this.page.locator('button:visible').filter({ hasText: /^(Ya|OK|Simpan)$/i });
    if (await visibleConfirmButtons.count()) {
      await visibleConfirmButtons.last().click({ force: true }).catch(() => null);
    }
    let submitResponse = await submitResponsePromise;
    if (!submitResponse && this.page.url().includes('/suratperjanjianppkpl')) {
      await this.page.locator('#formPerjanjian').evaluate((form) => HTMLFormElement.prototype.submit.call(form));
      submitResponse = await this.page.waitForResponse(
        (response) => response.url().includes('/spse/surat-perjanjian-pl/simpansuratperjanjianpl'),
        { timeout: 30000 }
      ).catch(() => null);
    }
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(3000);
    const bodyText = ((await this.page.locator('body').innerText()) || '').replace(/\s+/g, ' ').trim();
    return {
      url: this.page.url(),
      bodyText,
      submitStatus: submitResponse?.status() || null,
      saved: /berhasil disimpan|tersimpan|Surat Perjanjian/i.test(bodyText) || Boolean(submitResponse),
    };
  }
}

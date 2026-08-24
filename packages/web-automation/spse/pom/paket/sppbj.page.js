import { captureGuideStep } from '../../utils/guide-capture.js';

export class SppbjPage {
  constructor(page) {
    this.page = page;
  }

  async open(manifest) {
    const url = new URL(
      `/spse/sppbj-pl/sppbjppkpl?plId=${manifest.procurementPackageId}`,
      this.page.url()
    ).href;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.getByText('Form Surat Penunjukan Penyedia Barang/Jasa (SPPBJ)', { exact: false, }).waitFor({
      state: 'visible',
      timeout: 30000
    });
    return url;
  }

  async fillForm(data) {
    const form = this.page.locator('#formSppbj');
    await captureGuideStep(this.page, {
      instruction: 'Isi formulir SPPBJ dengan nomor, lampiran, tanggal, kota, jabatan, dan alamat satker',
      action: 'Isi',
      target: form,
      expected: 'Seluruh field wajib SPPBJ terisi dan Penyedia pemenang sudah terpilih.',
    });
    await form.locator('input[name="sppbj.sppbj_no"]').fill(data.sppbjNumber);
    await form.locator('input[name="sppbj.sppbj_lamp"]').fill(data.attachmentDescription);
    const dateInput = form.locator('input[name="sppbj.sppbj_tgl_kirim"]');
    await dateInput.click();
    await dateInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await dateInput.type(data.date);
    await dateInput.press('Tab');
    await form.locator('input[name="sppbj.sppbj_kota"]').fill(data.city);
    await form.locator('input[name="sppbj.jabatan_ppk_sppbj"]').fill(data.ppkTitle);
    await form.locator('input[name="sppbj.alamat_satker"]').fill(data.satkerAddress);
    await form.locator('input[name="sppbj.jaminan_pelaksanaan"]').fill(data.guaranteeValue);
    await form.locator('input[name="sppbj.masa_berlaku_jaminan"]').fill(data.guaranteeDays);
  }

  async save() {
    const saveButton = this.page.locator('button[name="simpan"]');
    await captureGuideStep(this.page, {
      instruction: 'Klik Simpan untuk menerbitkan SPPBJ',
      target: saveButton,
      expected: 'SPPBJ tersimpan dan tampil pada daftar e-Kontrak PPK.',
    });
    const submitResponsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/spse/sppbj-pl/simpansppbjpl'),
      { timeout: 30000 }
    ).catch(() => null);
    await saveButton.click();
    const confirmation = this.page.locator('#confirmation').getByRole('button', {
      name: 'Ya',
      exact: true
    });
    if (await confirmation.isVisible().catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Klik Ya pada konfirmasi pemeriksaan Daftar Hitam SPPBJ',
        target: confirmation,
        expected: 'SPPBJ dikirim untuk disimpan.',
      });
      await confirmation.click({ force: true });
    }
    const submitResponse = await submitResponsePromise;
    if (!submitResponse && this.page.url().includes('/sppbjppkpl')) {
      await this.page.locator('#formSppbj').evaluate((form) => HTMLFormElement.prototype.submit.call(form));
    }
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(3000);
    const bodyText = ((await this.page.locator('body').innerText()) || '')
      .replace(/\s+/g, ' ').trim();
    return {
      url: this.page.url(),
      bodyText,
      saved: !this.page.url().includes('/sppbjppkpl')
        || /SPPBJ|Surat Penunjukan|tersimpan|berhasil/i.test(bodyText),
    };
  }

  async sendContractInvitation(manifest, data) {
    const sppbjUrl = new URL(
      `/spse/sppbj-pl/sppbjppkpl?plId=${manifest.procurementPackageId}&sppbjId=${manifest.flow10SppbjId}`,
      this.page.url()
    ).href;
    await this.page.goto(sppbjUrl, { waitUntil: 'domcontentloaded' });
    const inviteLink = this.page.locator('#kirimEmail');
    await inviteLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim pada kolom Undangan Kontrak untuk membuka formulir undangan',
      target: inviteLink,
      expected: 'Formulir undangan kontrak untuk ANGSAE BARU terbuka.',
    });
    await inviteLink.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    const form = this.page.locator('#form-undang-kontrak');
    await form.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Isi waktu, tempat, mekanisme, dokumen yang dibawa, dan pihak yang hadir',
      action: 'Isi',
      target: form,
      expected: 'Seluruh data wajib undangan kontrak terisi.',
    });
    for (const [selector, value] of [
      ['#datetime-start', data.invitationStart],
      ['#datetime-end', data.invitationEnd],
    ]) {
      const input = form.locator(selector);
      await input.click();
      await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await input.type(value);
      await input.press('Tab');
    }
    await form.locator('textarea[name="tempat"]').fill(data.invitationPlace);
    await form.locator('select[name="is_online"]').selectOption(data.invitationOnline);
    if (data.invitationOnline === 'true') {
      await form.locator('textarea[name="link_pembuktian"]').fill(data.invitationLink);
    }
    await form.locator('textarea[name="dibawa"]').fill(data.invitationBring);
    await form.locator('textarea[name="hadir"]').fill(data.invitationAttend);
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim untuk mengirim undangan kontrak kepada ANGSAE BARU',
      target: form.locator('#kirim_pesan'),
      expected: 'Undangan kontrak terkirim melalui email dan inbox Penyedia.',
    });
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/spse/sppbj-pl/submitundanganpl'),
      { timeout: 30000 }
    ).catch(() => null);
    await form.locator('#kirim_pesan').click();
    const response = await responsePromise;
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(2000);
    const bodyText = ((await this.page.locator('body').innerText()) || '').replace(/\s+/g, ' ').trim();
    return {
      url: this.page.url(),
      bodyText,
      submitStatus: response?.status() || null,
      sent: Boolean(response) || /berhasil|terkirim|sudah dikirim/i.test(bodyText),
    };
  }
}

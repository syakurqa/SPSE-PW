import { captureGuideStep } from '../../utils/guide-capture.js';

export class EvaluationPage {
  constructor(page) {
    this.page = page;
  }

  async open(manifest) {
    const evaluationUrl = new URL(
      `/spse/evaluasinontender/${manifest.procurementPackageId}`,
      this.page.url()
    ).href;
    await this.page.goto(evaluationUrl, { waitUntil: 'domcontentloaded' });
    await this.page.getByText('Klik pada Nama Peserta untuk melakukan evaluasi', { exact: false }).waitFor({
      state: 'visible',
      timeout: 30000,
    });
    return evaluationUrl;
  }

  async openParticipant(providerQuery) {
    const participantLink = this.page.getByRole('link', { name: new RegExp(providerQuery, 'i'), }).first();
    await captureGuideStep(this.page, {
      instruction: `Klik nama Penyedia ${providerQuery} pada Hasil Evaluasi`,
      target: participantLink,
      expected: 'Detail evaluasi kualifikasi peserta terbuka.',
    });
    const href = await participantLink.getAttribute('href');
    await participantLink.click();
    await this.page.waitForLoadState('domcontentloaded');
    return href;
  }

  async sendVerificationInvitation(evaluationUrl, providerQuery, invitation) {
    await this.page.goto(evaluationUrl, { waitUntil: 'domcontentloaded' });
    const sendLink = this.page.getByRole('link', { name: /Kirim( Ulang)?/i }).first();
    if (!await sendLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return {
        sent: false,
        reason: 'Tautan undangan tidak tersedia.'
      };
    }
    const href = await sendLink.getAttribute('href');
    await sendLink.click();
    await this.page.waitForLoadState('domcontentloaded');
    const form = this.page.locator('form[action*="submit_kirim_und_pembuktian"]');
    await form.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: `Isi undangan pembuktian kualifikasi untuk ${providerQuery}`,
      action: 'Isi',
      target: form,
      expected: 'Form undangan pembuktian kualifikasi siap dikirim.',
    });
    await form.locator('input[name="waktu"]').fill(invitation.start);
    await form.locator('input[name="sampai"]').fill(invitation.end);
    await form.locator('textarea[name="tempat"]').fill(invitation.place);
    await form.locator('select[name="is_online"]').selectOption(invitation.mechanism);
    await form.locator('textarea[name="dibawa"]').fill(invitation.documents);
    await form.locator('textarea[name="hadir"]').fill(invitation.attendees);
    const submit = form.locator('button#kirim_pesan');
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim untuk mengirim undangan pembuktian kualifikasi',
      target: submit,
      expected: 'Undangan pembuktian terkirim kepada Penyedia.',
    });
    await submit.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return {
      sent: true,
      invitationUrl: href ? new URL(href, evaluationUrl).href : this.page.url(),
      bodyText: ((await this.page.locator('body').innerText()) || '').replace(/\s+/g, ' ').trim(),
    };
  }

  async confirmVmsVerification(evaluationUrl, providerQuery) {
    // The Verifikasi and Konfirmasi actions are rendered on the evaluation
    // overview table, not on the participant detail tab. Always return to the
    // overview before locating these actions so the flow is stable after the
    // optional detail screenshot/navigation.
    await this.page.goto(evaluationUrl, { waitUntil: 'domcontentloaded' });
    const verificationLink = this.page.getByRole('link', {
      name: 'Verifikasi',
      exact: true,
    });
    await verificationLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: `Buka Verifikasi VMS untuk ${providerQuery}`,
      target: verificationLink,
      expected: 'Halaman verifikasi data kualifikasi VMS terbuka.',
    });
    const verificationHref = await verificationLink.getAttribute('href');
    if (verificationHref) {
      await this.page.goto(new URL(verificationHref, this.page.url()).href, { waitUntil: 'domcontentloaded', });
      await this.page.screenshot({
        path: process.env.SPSE_FLOW7_VMS_SCREENSHOT || '/tmp/flow7-vms-verification.png',
        fullPage: true,
      });
    }

    await this.page.goto(evaluationUrl, { waitUntil: 'domcontentloaded' });
    const confirmationLink = this.page.getByRole('link', { name: /Konfirmasi|Terverifikasi/i, }).first();
    await confirmationLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    const confirmationLabel = ((await confirmationLink.innerText()) || '').trim();
    const confirmationHref = await confirmationLink.getAttribute('href');
    if (!confirmationHref) {
      throw new Error(`Konfirmasi VMS untuk ${providerQuery} tidak memiliki tautan.`);
    }
    const confirmationUrl = new URL(confirmationHref, evaluationUrl).href;
    if (/Terverifikasi/i.test(confirmationLabel)) {
      return {
        confirmationUrl,
        bodyText: ((await this.page.locator('body').innerText()) || '')
          .replace(/\s+/g, ' ').trim(),
        vmsVerificationUrl: verificationHref
          ? new URL(verificationHref, evaluationUrl).href
          : null,
        alreadyVerified: true,
      };
    }
    await this.page.goto(confirmationUrl, { waitUntil: 'domcontentloaded' });
    const confirmButton = this.page.getByRole('button', {
      name: /Konfirmasi/,
      exact: false,
    });
    await confirmButton.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Konfirmasi setelah verifikasi VMS selesai',
      target: confirmButton,
      expected: 'Verifikasi data kualifikasi Penyedia dikonfirmasi.',
    });
    await confirmButton.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    const bodyText = ((await this.page.locator('body').innerText()) || '')
      .replace(/\s+/g, ' ').trim();
    return {
      confirmationUrl,
      bodyText,
      vmsVerificationUrl: verificationHref
        ? new URL(verificationHref, evaluationUrl).href
        : null,
    };
  }

  async openNegotiation(evaluationUrl, providerQuery) {
    await this.page.goto(evaluationUrl, { waitUntil: 'domcontentloaded' });
    const participantRow = this.page.locator('tr').filter({ hasText: providerQuery, }).first();
    const negotiationLink = participantRow.getByRole('link', { name: /Input Hasil Negosiasi/i, }).first().or(this.page.getByRole('link', { name: /Input Hasil Negosiasi/i, }).first());
    await negotiationLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    const href = await negotiationLink.getAttribute('href');
    await captureGuideStep(this.page, {
      instruction: `Buka Input Hasil Negosiasi untuk ${providerQuery}`,
      target: negotiationLink,
      expected: 'Tabel harga negosiasi dan tombol Simpan ditampilkan.',
    });
    await negotiationLink.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.getByText('TOTAL HARGA NEGOSIASI', { exact: false }).waitFor({
      state: 'visible',
      timeout: 30000,
    });
    return {
      negotiationUrl: href ? new URL(href, evaluationUrl).href : this.page.url(),
      participantId: href?.match(/evaluasinontender\/([^/]+)\/negosiasi/)?.[1] || null,
    };
  }

  async setNegotiatedItemPrice(finalItemPrice) {
    const table = this.page.locator('#tbl-rincian .ht_master table.htCore');
    const row = table.locator('tbody tr').first();
    const editableCell = row.locator('td').nth(4);
    await editableCell.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: `Isi Harga Negosiasi sebesar ${finalItemPrice.toLocaleString('id-ID')}`,
      action: 'Isi',
      target: editableCell,
      expected: 'Harga negosiasi per item terisi dan total dihitung otomatis.',
    });
    await editableCell.dblclick();
    const editor = this.page.locator('textarea.handsontableInput:visible, input.handsontableInput:visible').last();
    await editor.waitFor({
      state: 'visible',
      timeout: 5000
    });
    await editor.fill(String(finalItemPrice));
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
    const cellText = (await editableCell.innerText()).replace(/\s+/g, ' ').trim();
    if (!cellText.includes(finalItemPrice.toLocaleString('id-ID').split(',')[0])) {
      throw new Error(`Harga negosiasi tidak berubah. Sel berisi: ${cellText}`);
    }
    return cellText;
  }

  async saveNegotiation() {
    const saveButton = this.page.locator('#simpan');
    await captureGuideStep(this.page, {
      instruction: 'Klik Simpan hasil klarifikasi dan negosiasi',
      target: saveButton,
      expected: 'Data berhasil tersimpan dan total harga negosiasi diperbarui.',
    });
    await saveButton.click();
    await this.page.getByText('Data berhasil tersimpan', { exact: false }).waitFor({
      state: 'visible',
      timeout: 30000,
    });
    const bodyText = ((await this.page.locator('body').innerText()) || '')
      .replace(/\s+/g, ' ').trim();
    return {
      bodyText,
      totalText: (await this.page.locator('#rekap #total_hps').innerText()).trim(),
    };
  }

  async openWinnerSelection(evaluationUrl, providerQuery) {
    await this.page.goto(evaluationUrl, { waitUntil: 'domcontentloaded' });
    const winnerLink = this.page.getByRole('link', { name: /Penetapan Pemenang/i, }).first();
    await winnerLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    const href = await winnerLink.getAttribute('href');
    await captureGuideStep(this.page, {
      instruction: `Buka Penetapan Pemenang untuk ${providerQuery}`,
      target: winnerLink,
      expected: 'Form urutan peserta untuk penetapan pemenang terbuka.',
    });
    if (!href) {
      throw new Error('Tautan Penetapan Pemenang tidak memiliki URL.');
    }
    await this.page.goto(new URL(href, evaluationUrl).href, { waitUntil: 'domcontentloaded', });
    await this.page.locator('#formPenetapanPemenang').waitFor({
      state: 'visible',
      timeout: 30000,
    });
    return { winnerUrl: href ? new URL(href, evaluationUrl).href : this.page.url(), };
  }

  async setWinner(providerQuery, winnerOrder = 1) {
    const row = this.page.locator('tr').filter({ hasText: providerQuery }).first();
    const orderInput = row.locator('input[name^="urutan["]').first();
    await orderInput.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: `Tetapkan ${providerQuery} pada urutan pemenang ${winnerOrder}`,
      action: 'Isi',
      target: orderInput,
      expected: 'Peserta berada pada urutan pertama sebagai calon pemenang.',
    });
    await orderInput.fill(String(winnerOrder));
    const submit = this.page.locator('#submit');
    await captureGuideStep(this.page, {
      instruction: 'Klik Submit untuk memeriksa dan menetapkan pemenang',
      target: submit,
      expected: 'Sistem menjalankan pemeriksaan Daftar Hitam dan menampilkan konfirmasi bila diperlukan.',
    });
    await submit.click();
    const confirmation = this.page.locator('#yes-confirm');
    if (await confirmation.isVisible({ timeout: 8000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Klik Ya pada konfirmasi pemeriksaan Daftar Hitam',
        target: confirmation,
        expected: 'Penetapan pemenang dikirim untuk diproses.',
      });
      await confirmation.click();
    }
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(1000);
    const bodyText = ((await this.page.locator('body').innerText()) || '')
      .replace(/\s+/g, ' ').trim();
    return {
      bodyText,
      url: this.page.url(),
      winnerSet: /Pemenang|Penetapan Pemenang|berhasil/i.test(bodyText),
    };
  }
}

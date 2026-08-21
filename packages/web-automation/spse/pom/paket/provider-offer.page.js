import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { captureGuideStep } from '../../utils/guide-capture.js';

const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.pdf', '.zip']);

export class ProviderOfferPage {
  constructor(page) {
    this.page = page;
  }

  async openQualificationFromPackage() {
    const sendDataLink = this.page.getByRole('link', { name: /^(Kirim Data|Ubah Data)$/, });
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim Data/Ubah Data pada Dokumen Kualifikasi',
      target: sendDataLink,
      expected: 'Wizard Data Kualifikasi terbuka.',
    });
    await sendDataLink.click();
    await this.page.getByText('Kirim Data Kualifikasi', { exact: true, }).first().waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  validateSelection(selection, scopeSelector) {
    if (selection === 'all') {
      return selection;
    }
    if (!Array.isArray(selection)
      || selection.some((index) => !Number.isInteger(index) || index < 0)) {
      throw new Error(
        `Konfigurasi ${scopeSelector} harus 'all' atau array indeks bilangan bulat non-negatif.`
      );
    }
    return [...new Set(selection)];
  }

  async showAllDataTableRows(scope) {
    const lengthSelect = scope.locator('select[name$="_length"]').first();
    if (!await lengthSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      return;
    }
    const allOptionValue = await lengthSelect.locator('option').evaluateAll(
      (options) => options.find((option) => /^(Semua|All)$/i.test(
        (option.textContent || '').trim()
      ))?.value || null
    );
    if (allOptionValue) {
      await lengthSelect.selectOption(allOptionValue);
      await this.page.waitForTimeout(250);
    }
  }

  async selectConfiguredData(scopeSelector, inputName, selection, subTabSelector) {
    const configuredSelection = this.validateSelection(
      selection,
      scopeSelector
    );
    const sectionTab = this.page.locator(`a[href="${scopeSelector}"]`).first();
    if (await sectionTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sectionTab.click();
    }
    if (subTabSelector) {
      const subTab = this.page.locator(`a[href="${subTabSelector}"]`).first();
      await subTab.waitFor({
        state: 'visible',
        timeout: 10000
      });
      await subTab.click();
    }
    const scope = this.page.locator(scopeSelector);
    await this.showAllDataTableRows(scope);
    const inputs = scope.locator(
      `input[type="checkbox"][name="${inputName}"]`
    );
    const count = await inputs.count();
    const indexes = configuredSelection === 'all'
      ? Array.from({ length: count }, (_, index) => index)
      : configuredSelection;
    if (configuredSelection === 'all' && count === 0) {
      throw new Error(
        `Tidak ada data pada ${scopeSelector}, padahal konfigurasi meminta 'all'.`
      );
    }
    for (const index of indexes) {
      if (index >= count) {
        throw new Error(
          `Indeks ${index} di ${scopeSelector} tidak tersedia; jumlah data ${count}.`
        );
      }
    }

    const selectedIndexes = new Set(indexes);
    for (let index = 0; index < count; index++) {
      const input = inputs.nth(index);
      const shouldBeChecked = selectedIndexes.has(index);
      if (shouldBeChecked && !await input.isChecked()) {
        await input.check({ force: true });
      } else if (!shouldBeChecked && await input.isChecked()) {
        await input.uncheck({ force: true });
      }
    }

    const mismatches = [];
    for (let index = 0; index < count; index++) {
      const actual = await inputs.nth(index).isChecked();
      const expected = selectedIndexes.has(index);
      if (actual !== expected) {
        mismatches.push({
          index,
          actual,
          expected
        });
      }
    }
    if (mismatches.length > 0) {
      throw new Error(
        `Pilihan ${scopeSelector} tidak deterministik: ${JSON.stringify(mismatches)}`
      );
    }
    return indexes.length;
  }

  assertUploadFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`File upload tidak ditemukan: ${filePath || '(kosong)'}`);
    }
    const extension = path.extname(filePath).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
      throw new Error(
        `Format ${extension || '(tanpa ekstensi)'} ditolak. Gunakan PDF atau ZIP.`
      );
    }
  }

  hashFile(filePath) {
    return crypto.createHash('sha256')
      .update(fs.readFileSync(filePath))
      .digest('hex');
  }

  async readUploadEvidence(scope, fileName) {
    return scope.locator('input:not([type="file"]), a, td, li, span, div')
      .evaluateAll((elements, expectedName) => {
        const expected = expectedName.toLowerCase();
        for (const element of elements) {
          const text = (element.textContent || '').trim();
          const value = 'value' in element ? String(element.value || '') : '';
          const key = `${element.id || ''} ${element.getAttribute('name') || ''}`;
          if (text.toLowerCase().includes(expected)
            || value.toLowerCase().includes(expected)) {
            return {
              type: 'filename',
              marker: (text || value).slice(0, 300),
            };
          }
          if (/(file.?id|uploaded|path)/i.test(key) && value.trim()) {
            return {
              type: 'metadata',
              marker: `${key.trim()}=${value.slice(0, 200)}`,
            };
          }
        }
        return null;
      }, fileName);
  }

  async uploadAndVerifyFile(fileInput, filePath, scope) {
    this.assertUploadFile(filePath);
    const fileName = path.basename(filePath);
    const relevantResponses = [];
    const responseListener = (response) => {
      const method = response.request().method();
      if (/upload|signedurl|storage/i.test(response.url()) || method === 'PUT') {
        relevantResponses.push({
          method,
          status: response.status(),
          url: response.url(),
        });
      }
    };
    this.page.on('response', responseListener);
    try {
      // Halaman SPSE menginisialisasi uploadFlow() melalui delegated handler
      // `click` pada #fileupload. setInputFiles() langsung akan melewati
      // handler tersebut, jadi gunakan file chooser seperti interaksi pengguna.
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser', { timeout: 15000 }),
        fileInput.click({ force: true }),
      ]);
      await fileChooser.setFiles(filePath);
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const failedResponse = relevantResponses.find(({ status }) => status >= 400);
        if (failedResponse) {
          throw new Error(
            `Request upload gagal (${failedResponse.status}): ${failedResponse.url}`
          );
        }
        const evidence = await this.readUploadEvidence(scope, fileName);
        const uploadCompleted = relevantResponses.some((response) => (
          response.method === 'PUT'
          || /uploadCheckStatus|uploadFlow/i.test(response.url)
        ) && response.status >= 200 && response.status < 300);
        const busyCount = await scope.locator(
          '[aria-busy="true"]:visible, .progress:visible, .uploading:visible'
        ).count();
        if (evidence && uploadCompleted && busyCount === 0) {
          return {
            fileName,
            size: fs.statSync(filePath).size,
            sha256: this.hashFile(filePath),
            evidence,
          };
        }
        await this.page.waitForTimeout(500);
      }
      throw new Error(
        `Upload ${fileName} belum menghasilkan baris atau metadata file setelah 60 detik. `
        + `Response terkait: ${JSON.stringify(relevantResponses.slice(-10))}`
      );
    } finally {
      this.page.off('response', responseListener);
    }
  }

  async fillAndSendQualification(qualification) {
    const selections = {
      businessPermits: await this.selectConfiguredData(
        '#ijin', 'ijin', qualification.businessPermits,
        '#tabIzinUsahaLainnyaPl'
      ),
      personnel: await this.selectConfiguredData(
        '#staf', 'staf', qualification.personnel
      ),
      experience: await this.selectConfiguredData(
        '#pengalaman', 'pengalaman', qualification.experience
      ),
      ongoingWork: await this.selectConfiguredData(
        '#pekerjaan', 'pengalaman', qualification.ongoingWork
      ),
      equipment: await this.selectConfiguredData(
        '#peralatan', 'alat', qualification.equipment
      ),
    };

    const taxTab = this.page.locator('a[href="#pajak"]').first();
    await taxTab.waitFor({
      state: 'visible',
      timeout: 10000
    });
    await taxTab.click();
    const checkKswp = this.page.getByRole('link', {
      name: 'Cek Valid KSWP',
      exact: true,
    });
    if (await checkKswp.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkKswp.click();
      await this.page.locator('#kswpI').waitFor({
        state: 'attached',
        timeout: 15000,
      });
    }

    const otherTab = this.page.locator('a[href="#lainnya"]').first();
    await otherTab.waitFor({
      state: 'visible',
      timeout: 10000
    });
    await otherTab.click();
    const uploadScope = this.page.locator('#lainnya');
    const upload = await this.uploadAndVerifyFile(
      uploadScope.locator('#fileupload'),
      qualification.otherRequirementFile,
      uploadScope
    );

    const sendButton = this.page.locator('#btnKirim');
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim Data Kualifikasi',
      target: sendButton,
      expected: 'Konfirmasi pengiriman Data Kualifikasi ditampilkan.',
    });
    await sendButton.click();
    const agreement = this.page.locator('#check_setuju');
    await agreement.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await agreement.check();
    const submitButton = this.page.locator('#submit-kualifikasi');
    await submitButton.waitFor({
      state: 'visible',
      timeout: 10000
    });
    if (await submitButton.isDisabled()) {
      throw new Error(
        'Tombol Kirim Data Kualifikasi tetap disabled setelah persetujuan dicentang.'
      );
    }
    await submitButton.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return {
      selections,
      upload
    };
  }

  async assertQualificationSent() {
    const qualificationRow = this.page.locator('#main tr').filter({ hasText: 'Dokumen Kualifikasi', }).first();
    await qualificationRow.waitFor({
      state: 'visible',
      timeout: 30000
    });
    const text = (await qualificationRow.innerText()).replace(/\s+/g, ' ').trim();
    if (/Status\s*:\s*Belum dikirim/i.test(text)) {
      throw new Error(`Data Kualifikasi belum terkirim. Aktual: ${text}`);
    }
    if (!/Status\s*:\s*(?:Sudah\s+dikirim|Terkirim|Dikirim)/i.test(text)) {
      throw new Error(`Status Data Kualifikasi tidak dikenali. Aktual: ${text}`);
    }
    if (!/(Lihat Data|Ubah Data|Batal Kirim)/i.test(text)) {
      throw new Error(
        `Kontrol pascakirim Data Kualifikasi tidak tersedia. Aktual: ${text}`
      );
    }
    return text;
  }

  async openOfferFromPackage() {
    const offerLink = this.page.getByRole('link', {
      name: 'Kirim Penawaran',
      exact: true,
    }).first();
    await offerLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim Penawaran',
      target: offerLink,
      expected: 'Tahap Surat Penawaran ditampilkan.',
    });
    await offerLink.click();
    await this.page.locator('#masa-berlaku').waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async agreeOfferLetter(validityDays) {
    if (!Number.isInteger(validityDays) || validityDays <= 0) {
      throw new Error('Masa berlaku penawaran harus bilangan bulat positif.');
    }
    const validityInput = this.page.locator('#masa-berlaku');
    await captureGuideStep(this.page, {
      instruction: `Isi masa berlaku penawaran ${validityDays} hari`,
      action: 'Isi',
      target: validityInput,
      expected: 'Masa berlaku Surat Penawaran terisi.',
    });
    await validityInput.fill(String(validityDays));
    if (await validityInput.inputValue() !== String(validityDays)) {
      throw new Error('Masa berlaku Surat Penawaran belum terisi dengan benar.');
    }
    const agreeButton = this.page.locator('#setuju');
    await captureGuideStep(this.page, {
      instruction: 'Klik Setuju pada Surat Penawaran',
      target: agreeButton,
      expected: 'Surat Penawaran disetujui dan tahap teknis dibuka.',
    });
    await agreeButton.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    const bodyText = (await this.page.locator('body').innerText())
      .replace(/\s+/g, ' ');
    if (/Anda belum mengirim surat penawaran|terjadi error/i.test(bodyText)) {
      throw new Error(`Surat Penawaran gagal disetujui: ${bodyText.slice(0, 500)}`);
    }
  }

  async readOfferStatus() {
    const offerRow = this.page.locator('#main tr').filter({ hasText: 'Penawaran Anda', }).first();
    await offerRow.waitFor({
      state: 'visible',
      timeout: 30000
    });
    return (await offerRow.innerText()).replace(/\s+/g, ' ').trim();
  }

  assertOfferLetterSent(statusText) {
    if (/Surat Penawaran\s*:\s*Belum Kirim/i.test(statusText)) {
      throw new Error(`Surat Penawaran belum terkirim. Aktual: ${statusText}`);
    }
    if (!/Surat Penawaran\s*:\s*(?:Sudah|Terkirim|Setuju)/i.test(statusText)) {
      throw new Error(`Status Surat Penawaran tidak dikenali: ${statusText}`);
    }
  }

  async openTechnicalOffer(manifest) {
    await this.page.goto(new URL(
      `/spse/dokumennontender/${manifest.procurementPackageId}/viewkirimpenawaranteknis`,
      this.page.url()
    ).href, { waitUntil: 'domcontentloaded', });
    const firstUpload = this.page.locator('input[type="file"][id^="upload-"]')
      .first();
    await firstUpload.waitFor({
      state: 'attached',
      timeout: 30000
    });
    const errorText = await this.page.getByText(
      /Anda belum mengirim surat penawaran/i
    ).isVisible({ timeout: 1000 }).catch(() => false);
    if (errorText) {
      throw new Error('Penawaran Teknis belum dapat dibuka sebelum Surat Penawaran disetujui.');
    }
  }

  async uploadAllTechnicalFiles(filePath) {
    this.assertUploadFile(filePath);
    const fileName = path.basename(filePath);
    const inputs = this.page.locator('input[type="file"][id^="upload-"]');
    const count = await inputs.count();
    if (count === 0) {
      throw new Error('Kontrol upload Penawaran Teknis tidak ditemukan.');
    }

    const uploads = [];
    for (let index = 0; index < count; index++) {
      const input = inputs.nth(index);
      const inputId = await input.getAttribute('id');
      const requirementId = inputId?.replace(/^upload-/, '');
      if (!requirementId) {
        throw new Error(`ID persyaratan teknis ke-${index + 1} tidak dikenali.`);
      }
      const card = input.locator('xpath=ancestor::*[contains(@class,"card")][1]');
      const requirement = (await card.locator('.card-header').innerText()
        .catch(() => `Persyaratan Teknis ${index + 1}`)).replace(/\s+/g, ' ')
        .trim();
      const fileList = this.page.locator(`#files-${requirementId}`);
      const existing = fileList.locator('li').filter({ hasText: fileName, })
        .first();
      let responseEvidence = 'existing';
      if (!await existing.isVisible({ timeout: 1000 }).catch(() => false)) {
        const responsePromise = this.page.waitForResponse((response) => (
          response.request().method() === 'POST'
          && /submitpenawaranteknis/i.test(response.url())
          && response.url().includes(`chk_id=${requirementId}`)
        ), { timeout: 60000 });
        const [fileChooser] = await Promise.all([
          this.page.waitForEvent('filechooser', { timeout: 15000 }),
          input.click({ force: true }),
        ]);
        await fileChooser.setFiles(filePath);
        const response = await responsePromise;
        const body = await response.json().catch(() => null);
        if (!response.ok() || body?.res?.status !== 'ok') {
          throw new Error(
            `Upload teknis ${requirement} gagal (${response.status()}): `
            + JSON.stringify(body)
          );
        }
        responseEvidence = `${response.request().method()} ${response.status()} ${response.url()}`;
      }
      const savedFile = fileList.locator('li').filter({ hasText: fileName, })
        .first();
      await savedFile.waitFor({
        state: 'visible',
        timeout: 30000
      });
      const downloadLink = savedFile.locator('a[href]').first();
      await downloadLink.waitFor({
        state: 'visible',
        timeout: 10000
      });
      uploads.push({
        requirementId,
        requirement,
        fileName,
        size: fs.statSync(filePath).size,
        sha256: this.hashFile(filePath),
        response: responseEvidence,
        downloadUrl: await downloadLink.getAttribute('href'),
      });
    }
    return uploads;
  }

  assertTechnicalOfferSent(statusText) {
    if (/Dokumen Teknis\s*:\s*Belum Kirim/i.test(statusText)) {
      throw new Error(`Dokumen Teknis belum terkirim. Aktual: ${statusText}`);
    }
    if (!/Dokumen Teknis\s*:\s*(?:Sudah|Terkirim)/i.test(statusText)) {
      throw new Error(`Status Dokumen Teknis tidak dikenali: ${statusText}`);
    }
  }

  async openPriceOffer(manifest) {
    await this.page.goto(new URL(
      `/spse/dokumennontender/${manifest.procurementPackageId}/viewkirimpenawaranpeserta`,
      this.page.url()
    ).href, { waitUntil: 'domcontentloaded', });
    await this.page.locator('#tbl-rincian').waitFor({
      state: 'visible',
      timeout: 30000
    });
    await this.page.locator('#simpan').waitFor({
      state: 'visible',
      timeout: 30000
    });
    const blocked = await this.page.getByText(
      /Anda belum mengirim surat penawaran|Anda belum mengirim penawaran teknis/i
    ).isVisible({ timeout: 1000 }).catch(() => false);
    if (blocked) {
      throw new Error(
        'Penawaran Harga belum dapat dibuka sebelum Surat Penawaran dan Dokumen Teknis terkirim.'
      );
    }
  }

  async uploadPriceRequirementFiles(configuredFiles = []) {
    if (!Array.isArray(configuredFiles)) {
      throw new Error('priceRequirementFiles harus berupa array path file atau null.');
    }
    const inputs = this.page.locator('input[type="file"][id^="upload-"]');
    const count = await inputs.count();
    if (configuredFiles.length > count) {
      throw new Error(
        `Fixture meminta ${configuredFiles.length} lampiran harga, tetapi kontrol yang tersedia ${count}.`
      );
    }

    const uploads = [];
    for (let index = 0; index < count; index++) {
      const filePath = configuredFiles[index];
      if (!filePath) {
        uploads.push({
          index,
          skipped: true,
        });
        continue;
      }
      this.assertUploadFile(filePath);
      const fileName = path.basename(filePath);
      const input = inputs.nth(index);
      const inputId = await input.getAttribute('id');
      const requirementId = inputId?.replace(/^upload-/, '');
      if (!requirementId) {
        throw new Error(`ID persyaratan harga ke-${index + 1} tidak dikenali.`);
      }
      const card = input.locator('xpath=ancestor::*[contains(@class,"card")][1]');
      const requirement = (await card.locator('.card-header').innerText()
        .catch(() => `Persyaratan Harga ${index + 1}`)).replace(/\s+/g, ' ')
        .trim();
      const fileList = this.page.locator(`#files-${requirementId}`);
      const existing = fileList.locator('li').filter({ hasText: fileName, })
        .first();
      let responseEvidence = 'existing';
      if (!await existing.isVisible({ timeout: 1000 }).catch(() => false)) {
        const responsePromise = this.page.waitForResponse((response) => (
          response.request().method() === 'POST'
          && /uploadpenawaranhargakonstruksi/i.test(response.url())
          && response.url().includes(`chk_id=${requirementId}`)
        ), { timeout: 60000 });
        const [fileChooser] = await Promise.all([
          this.page.waitForEvent('filechooser', { timeout: 15000 }),
          input.click({ force: true }),
        ]);
        await fileChooser.setFiles(filePath);
        const response = await responsePromise;
        const body = await response.json().catch(() => null);
        if (!response.ok() || body?.res?.status !== 'ok') {
          throw new Error(
            `Upload ${requirement} gagal (${response.status()}): ${JSON.stringify(body)}`
          );
        }
        responseEvidence = `${response.request().method()} ${response.status()} ${response.url()}`;
      }
      const savedFile = fileList.locator('li').filter({ hasText: fileName, })
        .first();
      await savedFile.waitFor({
        state: 'visible',
        timeout: 30000
      });
      const downloadLink = savedFile.locator('a[href]').first();
      await downloadLink.waitFor({
        state: 'visible',
        timeout: 10000
      });
      uploads.push({
        requirementId,
        requirement,
        fileName,
        size: fs.statSync(filePath).size,
        sha256: this.hashFile(filePath),
        response: responseEvidence,
        downloadUrl: await downloadLink.getAttribute('href'),
      });
    }
    return uploads;
  }

  async fillHandsontableCell(row, columnIndex, value) {
    const cell = row.locator('td').nth(columnIndex);
    await cell.scrollIntoViewIfNeeded();
    await cell.dblclick();
    const editor = this.page.locator('textarea.handsontableInput:visible').last();
    await editor.waitFor({
      state: 'visible',
      timeout: 5000
    });
    await editor.fill(String(value));
    await editor.press('Enter');
  }

  async readPriceTable() {
    return this.page.locator('#tbl-rincian').evaluate((element) => {
      const jquery = window.jQuery;
      const instance = jquery?.(element).data('handsontable');
      if (!instance) {
        throw new Error('Instance Handsontable Penawaran Harga tidak tersedia.');
      }
      return instance.getData().map((row) => ({ ...row }));
    });
  }

  async fillAndSavePrice({
    priceBeforeVat,
    vatPercent,
    tkdnPercent
  }) {
    for (const [label, value] of Object.entries({
      priceBeforeVat,
      vatPercent,
      tkdnPercent,
    })) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} harus berupa angka non-negatif.`);
      }
    }
    if (priceBeforeVat <= 0) {
      throw new Error('priceBeforeVat harus lebih besar dari nol.');
    }
    if (vatPercent > 100 || tkdnPercent > 100) {
      throw new Error('Persentase PPN dan TKDN tidak boleh melebihi 100%.');
    }
    const expectedTax = priceBeforeVat * vatPercent / 100;
    const expectedTotal = priceBeforeVat + expectedTax;
    const hps = Number(await this.page.locator('#nilai_hps_paket').inputValue());
    if (expectedTotal > hps) {
      throw new Error(
        `Total penawaran ${expectedTotal} melebihi HPS ${hps}.`
      );
    }

    const firstRow = this.page.locator(
      '#tbl-rincian .ht_master table.htCore tbody tr'
    ).first();
    await firstRow.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await this.fillHandsontableCell(firstRow, 3, priceBeforeVat);
    await this.fillHandsontableCell(firstRow, 4, vatPercent);

    const tkdn = this.page.locator('#inputPdnSingle');
    await captureGuideStep(this.page, {
      instruction: `Isi nilai TKDN/PDN ${tkdnPercent}%`,
      action: 'Isi',
      target: tkdn,
      expected: 'Total PDN dihitung dari total penawaran.',
    });
    await tkdn.fill(String(tkdnPercent));
    await tkdn.dispatchEvent('keyup');

    const tableBeforeSave = await this.readPriceTable();
    const row = tableBeforeSave[0];
    if (Number(row.harga) !== priceBeforeVat
      || Number(row.pajak) !== vatPercent
      || Number(row.total) !== expectedTax
      || Number(row.total_harga) !== expectedTotal) {
      throw new Error(
        `Perhitungan tabel harga tidak sesuai sebelum Simpan: ${JSON.stringify(row)}`
      );
    }
    const expectedPdn = expectedTotal * tkdnPercent / 100;
    const actualPdn = Number(await this.page.locator('#totalpdni').inputValue());
    if (actualPdn !== expectedPdn) {
      throw new Error(
        `Total PDN tidak sesuai. Diharapkan ${expectedPdn}, aktual ${actualPdn}.`
      );
    }

    const saveResponsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && /\/penawaransubmit(?:\?|$)/i.test(response.url())
    ), { timeout: 30000 });
    const saveButton = this.page.locator('#simpan');
    await captureGuideStep(this.page, {
      instruction: 'Klik Simpan pada Penawaran Harga',
      target: saveButton,
      expected: 'Rincian harga, PPN, dan TKDN tersimpan.',
    });
    await saveButton.click();
    const response = await saveResponsePromise;
    const body = await response.json().catch(() => null);
    if (!response.ok() || body?.result !== 'ok') {
      throw new Error(
        `Penyimpanan Penawaran Harga gagal (${response.status()}): ${JSON.stringify(body)}`
      );
    }
    const requestParameters = new URLSearchParams(
      response.request().postData() || ''
    );
    const submittedPdn = Number(
      requestParameters.get('model[nilai_pdn]')
    );
    if (submittedPdn !== expectedPdn) {
      throw new Error(
        `Payload PDN tidak sesuai. Diharapkan ${expectedPdn}, aktual ${submittedPdn}.`
      );
    }
    await this.page.locator('#alert .alert-success').filter({ hasText: /berhasil tersimpan/i, }).waitFor({
      state: 'visible',
      timeout: 15000
    });

    await this.page.reload({ waitUntil: 'domcontentloaded', });
    await this.page.locator('#simpan').waitFor({
      state: 'visible',
      timeout: 30000
    });
    const saved = (await this.readPriceTable())[0];
    if (Number(saved.harga) !== priceBeforeVat
      || Number(saved.pajak) !== vatPercent
      || Number(saved.total_harga) !== expectedTotal) {
      throw new Error(
        `Penawaran Harga tidak persisten setelah reload: ${JSON.stringify(saved)}`
      );
    }
    const savedTkdn = Number(await this.page.locator('#inputPdnSingle').inputValue());
    if (![0, tkdnPercent].includes(savedTkdn)) {
      throw new Error(
        `Nilai TKDN tidak persisten setelah reload. Diharapkan ${tkdnPercent}, aktual ${savedTkdn}.`
      );
    }
    return {
      priceBeforeVat,
      vatPercent,
      tax: expectedTax,
      total: expectedTotal,
      tkdnPercent,
      totalPdn: expectedPdn,
      submittedPdn,
      hps,
      savedRow: saved,
      tkdnUiValueAfterReload: savedTkdn,
      tkdnUiPersisted: savedTkdn === tkdnPercent,
      tkdnPersistenceNote: savedTkdn === tkdnPercent
        ? null
        : 'Server menerima payload Total PDN, tetapi input persentase PDN kembali 0 setelah reload.',
    };
  }

  assertPriceOfferSent(statusText, expectedTotal) {
    if (/Dokumen Harga\s*:\s*Belum Kirim/i.test(statusText)) {
      throw new Error(`Dokumen Harga belum terkirim. Aktual: ${statusText}`);
    }
    if (!/Dokumen Harga\s*:\s*(?:Sudah|Terkirim)/i.test(statusText)) {
      throw new Error(`Status Dokumen Harga tidak dikenali: ${statusText}`);
    }
    const totalMatch = statusText.match(
      /Total Penawaran\s*:\s*Rp\.?\s*([\d.]+),(\d{2})/i
    );
    const actualTotal = totalMatch
      ? Number(totalMatch[1].replace(/\./g, '')) + Number(totalMatch[2]) / 100
      : Number.NaN;
    if (actualTotal !== expectedTotal) {
      throw new Error(
        `Total Penawaran tidak sesuai. Diharapkan ${expectedTotal}, aktual ${actualTotal}. Status: ${statusText}`
      );
    }
    return actualTotal;
  }

  assertAllOfferComponentsSent(statusText, expectedTotal) {
    this.assertOfferLetterSent(statusText);
    this.assertTechnicalOfferSent(statusText);
    return this.assertPriceOfferSent(statusText, expectedTotal);
  }

  async downloadEvidence(link, label) {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 30000 }),
      link.click(),
    ]);
    const failure = await download.failure();
    if (failure) {
      throw new Error(`Download ${label} gagal: ${failure}`);
    }
    const downloadPath = await download.path();
    if (!downloadPath || !fs.existsSync(downloadPath)) {
      throw new Error(`File hasil download ${label} tidak ditemukan.`);
    }
    const buffer = fs.readFileSync(downloadPath);
    if (buffer.length === 0) {
      throw new Error(`File hasil download ${label} kosong.`);
    }
    return {
      label,
      fileName: download.suggestedFilename(),
      size: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      url: await link.getAttribute('href'),
    };
  }

  async collectFinalSubmissionEvidence(expectedTotal) {
    const status = await this.readOfferStatus();
    const total = this.assertAllOfferComponentsSent(status, expectedTotal);
    const receiptLink = this.page.getByRole('link', { name: /Tanda Terima Elektronik|Bukti Penyampaian|\bTTE\b/i, }).first();
    let receipt;
    if (await receiptLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      receipt = {
        status: 'AVAILABLE',
        download: await this.downloadEvidence(receiptLink, 'TTE/Bukti Penyampaian'),
      };
    } else {
      receipt = {
        status: 'NOT_EXPOSED_BY_CURRENT_UI',
        note: 'Tidak ada link Tanda Terima Elektronik/Bukti Penyampaian/TTE pada halaman paket maupun wizard penawaran.',
      };
    }

    const priceDownload = this.page.getByRole('link', {
      name: 'Download Penawaran Harga',
      exact: true,
    });
    await priceDownload.waitFor({
      state: 'visible',
      timeout: 10000
    });
    return {
      status,
      total,
      receipt,
      priceDocument: await this.downloadEvidence(
        priceDownload,
        'Penawaran Harga'
      ),
    };
  }
}

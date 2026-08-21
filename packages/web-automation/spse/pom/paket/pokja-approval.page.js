import fs from 'fs';
import { captureGuideStep } from '../../utils/guide-capture.js';

export class PokjaApprovalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async openAssignedPackage(manifest) {
    const packageList = this.page.getByRole('link', {
      name: 'DAFTAR PAKET',
      exact: true
    });
    if (await packageList.isVisible({ timeout: 10000 }).catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Klik DAFTAR PAKET pada dashboard Pokja',
        target: packageList,
        expected: 'Daftar paket Pokja ditampilkan.'
      });
      await packageList.click();
    }
    const nonTenderLink = this.page.getByRole('link', {
      name: 'Non Tender',
      exact: true
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik tab Non Tender',
      target: nonTenderLink,
      expected: 'Paket Penunjukan Langsung ditampilkan.'
    });
    await nonTenderLink.click();

    const packageRowByName = this.page.locator('table tbody tr')
      .filter({ hasText: manifest.packageName });
    const packageRowById = this.page.locator('table tbody tr')
      .filter({ hasText: manifest.packageId });
    const packageRow = packageRowByName.or(packageRowById).first();
    await packageRow.waitFor({
      state: 'visible',
      timeout: 30000
    });

    const packageHref = await packageRow.locator(
      'a[href^="/spse/nontender/"]'
    ).first().getAttribute('href');
    const packageIdMatch = packageHref?.match(/^\/spse\/nontender\/([^/]+)/);
    this.activePackageId = packageIdMatch?.[1] || manifest.packageId;

    const assignmentLink = packageRow.getByRole('link', { name: /Buat Non Tender/ });
    if (await assignmentLink.isVisible().catch(() => false)) {
      await captureGuideStep(this.page, {
        instruction: 'Klik Buat Non Tender pada paket yang ditugaskan',
        target: assignmentLink,
        expected: 'Halaman konfigurasi paket terbuka.'
      });
      await assignmentLink.click();
    } else {
      const packageLink = packageRow.locator(
        `a[href*="/paketnontender/${manifest.packageId}"]`
      ).or(packageRow.getByRole('link', {
        name: manifest.packageName,
        exact: true
      })).first();
      await packageLink.click();
    }

    await this.page.waitForLoadState('domcontentloaded');
    const mainText = (await this.page.locator('#main').textContent())
      ?.replace(/\s+/g, ' ');
    if (!mainText?.includes(manifest.packageName)) {
      throw new Error(
        `Paket "${manifest.packageName}" tidak terbuka pada sesi Pokja.`
      );
    }
  }

  async configurePackage(data) {
    await this.configureBusinessQualification(data.businessQualification);
    await this.configureSchedule(data.schedule);
    await this.configureQualification(data.qualification);
    await this.configureOfferValidity(data.offerValidityDays);
    await this.configureOfferDocuments(data.offerDocument);
    await this.uploadSdp(data.sdpNumber, data.documents.sdp);
    await this.sendInvitation(data.invitation, data.documents.invitation);
    await this.uploadMinutes(data.documents.minutes);
    await this.selectProvider(data.provider);
  }

  async configureBusinessQualification(label) {
    const qualificationSelect = this.page.locator(
      '#main tr:has-text("Kualifikasi Usaha") select'
    );
    await qualificationSelect.waitFor({
      state: 'visible',
      timeout: 15000
    });
    const selectedLabel = await qualificationSelect.locator(
      'option:checked'
    ).textContent();
    if (selectedLabel?.trim() !== label) {
      await qualificationSelect.selectOption({ label });
    }
  }

  async isPackageConfigurationComplete(providerQuery) {
    const main = this.page.locator('#main');
    const text = (await main.textContent())?.replace(/\s+/g, ' ') || '';
    return [
      'Semua Jadwal berhasil tersimpan',
      'Sudah Kirim Email',
      'Berita Acara Hasil Reviu',
      providerQuery,
    ].every((marker) => text.toLowerCase().includes(
      marker.toLowerCase()
    ));
  }

  async configureSchedule(schedule) {
    const scheduleLink = this.page.locator(
      '#main tr:has(th:has-text("Jadwal Paket")) a'
    ).first();
    await scheduleLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Jadwal Paket',
      target: scheduleLink,
      expected: 'Form sembilan tahap jadwal terbuka.'
    });
    await scheduleLink.click();

    const baseDate = await this.getDefaultTrainingSessionDate();
    for (let index = 0; index < schedule.stageCount; index++) {
      const date = this.addDays(
        baseDate,
        schedule.firstDayOffset + index
      );
      await this.setDateTime(
        this.page.locator(`#mulai${index}`),
        date,
        schedule.startHour
      );
      await this.setDateTime(
        this.page.locator(`#akhir${index}`),
        date,
        schedule.endHour
      );
    }

    await captureGuideStep(this.page, {
      instruction: 'Klik Simpan setelah jadwal H+1 sampai H+9 diisi',
      target: this.page.getByRole('button', { name: /Simpan/ }).first(),
      expected: 'Semua Jadwal berhasil tersimpan.'
    });
    await this.clickSave();
    await this.page.getByText(
      'Data jadwal Non Tender telah tersimpan',
      { exact: false }
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
    await this.clickBack();
  }

  async setDateTime(locator, date, hour) {
    await locator.waitFor({
      state: 'visible',
      timeout: 15000
    });
    const value = this.formatDateTime(date, hour);
    await locator.evaluate((element, nextValue) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      );
      if (descriptor?.set) {
        descriptor.set.call(element, nextValue);
      } else {
        element.value = nextValue;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }, value);

    const actualValue = await locator.inputValue();
    if (actualValue !== value) {
      throw new Error(
        `Tanggal jadwal gagal diisi. Diharapkan "${value}", aktual "${actualValue}".`
      );
    }
  }

  startOfLocalDay(date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  }

  async getDefaultTrainingSessionDate() {
    const sessionPage = await this.page.context().newPage();
    try {
      await sessionPage.goto(
        new URL('/spse/training/beranda', this.page.url()).href,
        { waitUntil: 'domcontentloaded' }
      );
      const mainText = (await sessionPage.locator('#main').textContent())
        ?.replace(/\s+/g, ' ') || '';
      const match = mainText.match(
        /Sesi Aktif:\s*Sesi Default\s*[—-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i
      );
      if (!match) {
        throw new Error(
          'Tanggal aktif Sesi Default tidak ditemukan pada halaman Simulasi Tanggal Sistem.'
        );
      }
      const monthIndexes = {
        januari: 0,
        februari: 1,
        maret: 2,
        april: 3,
        mei: 4,
        juni: 5,
        juli: 6,
        agustus: 7,
        september: 8,
        oktober: 9,
        november: 10,
        desember: 11,
      };
      const monthIndex = monthIndexes[match[2].toLowerCase()];
      if (monthIndex === undefined) {
        throw new Error(`Nama bulan Sesi Default tidak dikenali: ${match[2]}`);
      }
      return new Date(Number(match[3]), monthIndex, Number(match[1]));
    } finally {
      await sessionPage.close();
    }
  }

  addDays(date, numberOfDays) {
    const result = new Date(date);
    result.setDate(result.getDate() + numberOfDays);
    return result;
  }

  formatDateTime(date, hour) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year} ${String(hour).padStart(2, '0')}:00`;
  }

  async configureQualification(qualification) {
    const qualificationLink = this.page.getByRole('link', { name: /Persyaratan Kualifikasi/ });
    await captureGuideStep(this.page, {
      instruction: 'Klik Persyaratan Kualifikasi',
      target: qualificationLink,
      expected: 'Form klasifikasi dan persyaratan terbuka.'
    });
    await qualificationLink.click();
    if (await this.isQualificationConfigured(qualification)) {
      await this.completeOpenKbkiDialog();
      await this.clickSave();
      await this.page.waitForTimeout(1000);
      await this.clickBack();
      return;
    }
    await this.page.getByText(
      'Pilih Sumber Klasifikasi...'
    ).click();
    await this.page.getByRole('option', { name: qualification.source }).click();

    const classificationSearch = this.page.getByRole('searchbox', { name: 'Pilih atau ketik Klasifikasi' });
    await classificationSearch.fill(qualification.query);
    await this.page.getByRole('option', { name: qualification.classification }).click();

    await this.checkIndexedInputs(
      'syaratAdmin',
      qualification.administrativeIndexes
    );
    await this.checkIndexedInputs(
      'syaratTeknis',
      qualification.technicalIndexes
    );
    if (qualification.kbkiQuery && !await this.hasConfiguredKbki()) {
      await this.openKbkiDialog();
      await this.completeOpenKbkiDialog();
      if (process.env.SPSE_DEBUG_FLOW3 === 'true') {
        await this.page.screenshot({
          path: '/tmp/flow3-kbki-modal.png',
          fullPage: true,
        });
      }
    }
    await this.completeOpenKbkiDialog();
    await this.clickSave();
    await this.page.waitForTimeout(2000);
    if (!await this.isQualificationConfigured(qualification)) {
      const kbkiTableTextAfterSave = (await this.page.getByText(
        'Tabel Data KBKI',
        { exact: true }
      ).locator('xpath=following::table[1]').textContent().catch(() => '')) || '';
      throw new Error(
        'Persyaratan Kualifikasi belum lengkap setelah Simpan. '
        + `Isi tabel KBKI: "${kbkiTableTextAfterSave.replace(/\s+/g, ' ').trim()}". `
        + `Baris hasil terakhir: ${this.lastKbkiRowHtml || '(tidak terekam)'}`
      );
    }
    if (process.env.SPSE_DEBUG_FLOW3 === 'true') {
      await this.page.screenshot({
        path: '/tmp/flow3-qualification-after-save.png',
        fullPage: true,
      });
    }
    await this.clickBack();
  }

  async openKbkiDialog() {
    const addKbkiButton = this.page.locator('#tambahKbki');
    const kbkiDialog = this.page.locator('#kbkiModal');
    await addKbkiButton.waitFor({
      state: 'visible',
      timeout: 15000,
    });

    // Exercise the same UI action as a user first. The current SPSE page can
    // render Bootstrap's data attributes without activating its delegated
    // modal handler, so use the loaded modal API only when that click is inert.
    await addKbkiButton.click();
    if (await kbkiDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }

    const fallback = await this.page.evaluate(() => {
      const modal = document.querySelector('#kbkiModal');
      const button = document.querySelector('#tambahKbki');
      const jquery = globalThis.jQuery || globalThis.$;
      const bootstrap = globalThis.bootstrap;
      let strategy = 'none';
      let error = null;

      try {
        if (modal && jquery?.fn?.modal) {
          jquery(modal).modal('show');
          strategy = 'jquery-modal';
        } else if (modal && bootstrap?.Modal) {
          bootstrap.Modal.getOrCreateInstance(modal).show();
          strategy = 'bootstrap-modal';
        }
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }

      return {
        strategy,
        error,
        button: button?.outerHTML || null,
        modalExists: Boolean(modal),
        modalClass: modal?.className || null,
        modalStyle: modal?.getAttribute('style') || null,
        modalAriaHidden: modal?.getAttribute('aria-hidden') || null,
        jqueryModalAvailable: Boolean(jquery?.fn?.modal),
        bootstrapModalAvailable: Boolean(bootstrap?.Modal),
      };
    });

    const openedByFallback = await kbkiDialog.waitFor({
      state: 'visible',
      timeout: 10000,
    }).then(() => true).catch(() => false);
    if (!openedByFallback) {
      throw new Error(
        'Modal Daftar KBKI tidak terbuka setelah klik #tambahKbki dan fallback API modal. '
        + `Diagnostik: ${JSON.stringify(fallback)}`
      );
    }
  }

  async completeOpenKbkiDialog() {
    const kbkiDialog = this.page.locator('#kbkiModal');
    if (!await kbkiDialog.isVisible().catch(() => false)) {
      return false;
    }

    const bootstrapSelect = kbkiDialog.locator('.bootstrap-select')
      .filter({ hasText: /Pilih Deskripsi|Deskripsi/i }).first();
    if (await bootstrapSelect.isVisible().catch(() => false)) {
      const descriptionToggle = bootstrapSelect.locator(
        'button.dropdown-toggle'
      ).first();
      await descriptionToggle.click();

      const liveSearch = bootstrapSelect.locator(
        '.bs-searchbox input'
      ).first();
      await liveSearch.waitFor({
        state: 'visible',
        timeout: 15000,
      });
      await liveSearch.fill('');
      await liveSearch.pressSequentially('b', { delay: 150 });

      // bootstrap-select may append its menu directly to <body>, so the
      // results cannot reliably be scoped below #kbkiModal/.bootstrap-select.
      const descriptionOption = this.page.locator(
        '.dropdown-menu.show li:not(.disabled):not(.hidden) a[role="option"], '
        + '.dropdown-menu.show li:not(.disabled):not(.hidden) a, '
        + '.dropdown-menu.show .dropdown-item:not(.disabled)'
      ).filter({ hasNotText: /Pilih Deskripsi|No results|Tidak ada hasil|Mencari|Searching/i, }).first();
      const visibleOptionFound = await descriptionOption.waitFor({
        state: 'visible',
        timeout: 30000,
      }).then(() => true).catch(() => false);
      if (visibleOptionFound) {
        await descriptionOption.click();
      } else {
        const nativeSelect = bootstrapSelect.locator('select').first();
        const nativeOptions = await nativeSelect.locator('option').evaluateAll(
          (options) => options.map((option) => ({
            value: option.value,
            text: option.textContent?.replace(/\s+/g, ' ').trim() || '',
          }))
        );
        const nativeChoice = nativeOptions.find((option) => (
          option.value
          && !/Pilih Deskripsi|Tidak ada hasil|No results/i.test(option.text)
        ));
        if (nativeChoice) {
          await nativeSelect.selectOption(
            { value: nativeChoice.value },
            { force: true }
          );
          await nativeSelect.dispatchEvent('change');
        } else {
          const openDropdownHtml = await this.page.locator(
            '.dropdown-menu.show'
          ).evaluateAll((menus) => menus.map(
            (menu) => menu.outerHTML.slice(0, 3000)
          ));
          throw new Error(
            'Pilihan Deskripsi KBKI tidak muncul setelah mengetik "b". '
            + `Native options (${nativeOptions.length}): ${JSON.stringify(nativeOptions)}. `
            + `Dropdown terbuka: ${JSON.stringify(openDropdownHtml)}`
          );
        }
      }
    } else {
      const descriptionSelect = kbkiDialog.locator(
        '.select2-selection'
      ).first();
      await descriptionSelect.click();
      const select2Search = this.page.locator(
        '.select2-container--open input.select2-search__field'
      ).last();
      await select2Search.fill('b');
      const descriptionOption = this.page.locator(
        '.select2-results__option[role="option"], .select2-results__option'
      ).filter({ hasNotText: /Pilih Deskripsi|No results|Tidak ada|Mencari|Searching/i, }).first();
      await descriptionOption.waitFor({
        state: 'visible',
        timeout: 30000,
      });
      await descriptionOption.click();
    }

    const searchKbkiButton = kbkiDialog.getByRole('button', {
      name: 'Cari KBKI',
      exact: true,
    });
    await searchKbkiButton.click();

    const kbkiRow = kbkiDialog.locator('tbody tr')
      .filter({ hasNotText: /Tidak ada data|No data available/i }).first();
    await kbkiRow.waitFor({
      state: 'visible',
      timeout: 30000
    });
    this.lastKbkiRowHtml = await kbkiRow.evaluate(
      (element) => element.outerHTML
    );
    const rowSelection = kbkiRow.locator(
      'input[type="radio"], input[type="checkbox"]'
    ).first();
    if (await rowSelection.isVisible().catch(() => false)) {
      await rowSelection.check({ force: true });
    } else {
      await kbkiRow.click();
    }
    await kbkiDialog.getByRole('button', {
      name: 'Tambah',
      exact: true,
    }).click();
    await kbkiDialog.waitFor({
      state: 'hidden',
      timeout: 30000
    });
    return true;
  }

  async isQualificationConfigured(qualification) {
    const mainText = (await this.page.locator('#main').textContent()) || '';
    const classificationPresent = mainText.includes('1075');
    if (!classificationPresent) {
      return false;
    }
    const requiredIndexes = [
      ...qualification.administrativeIndexes.map((index) => [
        'syaratAdmin',
        index
      ]),
      ...qualification.technicalIndexes.map((index) => [
        'syaratTeknis',
        index
      ]),
    ];
    for (const [group, index] of requiredIndexes) {
      const checkbox = this.page.locator(
        `input[type="checkbox"][name="${group}[${index}].ckm_id"]`
      );
      if (!await checkbox.isChecked().catch(() => false)) {
        return false;
      }
    }
    if (qualification.kbkiQuery && !await this.hasConfiguredKbki()) {
      return false;
    }
    return true;
  }

  async hasConfiguredKbki() {
    const kbkiTable = this.page.getByText(
      'Tabel Data KBKI',
      { exact: true }
    ).locator('xpath=following::table[1]');
    const rows = kbkiTable.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    for (let index = 0; index < rowCount; index++) {
      const row = rows.nth(index);
      if (!await row.isVisible().catch(() => false)) {
        continue;
      }
      const text = ((await row.textContent().catch(() => '')) || '')
        .replace(/\s+/g, ' ').trim();
      const cellCount = await row.locator('td').count().catch(() => 0);
      if (cellCount > 0 && text && !/Tidak ada data/i.test(text)) {
        return true;
      }
    }
    return false;
  }

  async configureOfferValidity(days) {
    const validityLink = this.page.getByRole('link', { name: /Masa Berlaku Penawaran/ });
    await captureGuideStep(this.page, {
      instruction: 'Klik Masa Berlaku Penawaran',
      target: validityLink,
      expected: 'Field masa berlaku ditampilkan.'
    });
    await validityLink.click();
    const validityInput = this.page.locator('#masaberlaku');
    await captureGuideStep(this.page, {
      instruction: `Isi masa berlaku penawaran ${days} hari`,
      action: 'Isi',
      target: validityInput,
      expected: 'Masa berlaku tersimpan.'
    });
    await validityInput.fill(String(days));
    await this.page.getByRole('button', {
      name: 'Simpan',
      exact: true
    }).click();
  }

  async configureOfferDocuments(documentData) {
    const offerDocumentLink = this.page.getByRole('link', { name: /Dokumen Penawaran/ });
    await captureGuideStep(this.page, {
      instruction: 'Klik Dokumen Penawaran',
      target: offerDocumentLink,
      expected: 'Daftar persyaratan dokumen ditampilkan.'
    });
    await offerDocumentLink.click();
    await this.checkIndexedInputs(
      'syaratAdmin',
      documentData.administrativeIndexes
    );
    await this.checkIndexedInputs(
      'syarat',
      documentData.requirementIndexes
    );
    await this.checkIndexedInputs(
      'syaratHarga',
      documentData.priceIndexes
    );
    await this.clickSave();
    await this.page.getByText(
      'Persyaratan Dokumen tersimpan',
      { exact: false }
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
    await this.clickBack();
  }

  async checkIndexedInputs(group, indexes) {
    for (const index of indexes) {
      const checkbox = this.page.locator(
        `input[type="checkbox"][name="${group}[${index}].ckm_id"]`
      );
      if (await checkbox.count() === 0) {
        continue;
      }
      await checkbox.waitFor({
        state: 'visible',
        timeout: 15000
      });
      if (await checkbox.isEnabled() && !await checkbox.isChecked()) {
        await checkbox.check({ force: true }).catch(() => null);
      }
    }
  }

  async uploadSdp(number, documentPath) {
    const documentSelectionRow = this.page.getByText(
      'Dokumen Pemilihan',
      { exact: true }
    ).first().locator('xpath=ancestor::tr[1]');
    const uploadLink = documentSelectionRow.getByRole('link', {
      name: 'Upload',
      exact: true
    }).first();
    if (!await uploadLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }
    await captureGuideStep(this.page, {
      instruction: 'Klik Upload pada Dokumen Pemilihan (SDP)',
      action: 'Unggah',
      target: uploadLink,
      expected: 'Form upload SDP terbuka.'
    });
    await uploadLink.click();
    await this.page.locator('input[name="nomorSDP"]').fill(number);
    await this.setVisibleFileInput(documentPath);
    const uploadButton = this.page.locator(
      '#btn-cetak-dokumen:not(.disabled)'
    );
    await uploadButton.waitFor({
      state: 'visible',
      timeout: 60000
    });
    await uploadButton.click({ force: true });
    await this.page.getByText(
      'Upload Dokumen Pemilihan berhasil.',
      { exact: false }
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async sendInvitation(invitation, documentPath) {
    if (await this.page.getByText(
      'Sudah Kirim Email',
      { exact: false }
    ).isVisible().catch(() => false)) {
      return;
    }
    const sendLink = this.page.getByRole('link', {
      name: 'Kirim',
      exact: true
    });
    if (!await sendLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim untuk membuat undangan reviu DPP',
      target: sendLink,
      expected: 'Form undangan ditampilkan.'
    });
    await sendLink.click();
    const baseDate = await this.getDefaultTrainingSessionDate();
    await this.setDateTime(
      this.page.locator('#datetime-start'),
      this.addDays(baseDate, 1),
      9
    );
    await this.setDateTime(
      this.page.locator('#datetime-end'),
      this.addDays(baseDate, 1),
      12
    );
    await this.page.locator('textarea[name="tempat"]').fill(
      invitation.place
    );
    await this.page.locator('textarea[name="dibawa"]').fill(
      invitation.equipment
    );
    await this.page.locator('textarea[name="hadir"]').fill(
      invitation.attendees
    );
    await this.setVisibleFileInput(documentPath);
    const sendButton = this.page.getByRole('button', { name: /Kirim Pesan/ });
    await sendButton.waitFor({
      state: 'visible',
      timeout: 60000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim Pesan untuk mengirim undangan',
      target: sendButton,
      expected: 'Undangan reviu DPP berhasil terkirim.'
    });
    await sendButton.click({ noWaitAfter: true });
    await this.page.getByText(
      'Undangan reviu DPP berhasil terkirim.',
      { exact: false }
    ).waitFor({
      state: 'visible',
      timeout: 60000
    });
  }

  async uploadMinutes(documentPath) {
    if (await this.page.getByText(
      'BA Reviu DPP',
      { exact: false }
    ).isVisible().catch(() => false)) {
      return;
    }
    const uploadLink = this.page.getByRole('link', {
      name: 'Upload',
      exact: true
    }).last();
    if (!await uploadLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }
    await captureGuideStep(this.page, {
      instruction: 'Klik Upload untuk mengunggah BA hasil reviu',
      action: 'Unggah',
      target: uploadLink,
      expected: 'Form upload BA reviu terbuka.'
    });
    await uploadLink.click();
    await this.setVisibleFileInput(documentPath);
    const uploadButton = this.page.locator(
      '#kirim_pesan:not(.disabled):not([disabled])'
    );
    await uploadButton.waitFor({
      state: 'visible',
      timeout: 60000
    });
    await uploadButton.click({ noWaitAfter: true });
    await this.page.getByText(
      'Berhasil upload BA hasil Reviu DPP dan Kirim Pesan ke PPK',
      { exact: false }
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async selectProvider(provider) {
    const existingProvider = this.page.locator('#main table tr')
      .filter({ hasText: provider.query }).first();
    if (await existingProvider.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }
    const providerLink = this.page.getByRole('link', { name: /Pilih Penyedia/ });
    await captureGuideStep(this.page, {
      instruction: 'Klik Pilih Penyedia',
      target: providerLink,
      expected: 'Halaman pencarian penyedia terbuka.'
    });
    await providerLink.click();
    const search = this.page.getByRole('textbox', { name: /Silakan diisi dengan Nama/ });
    await search.fill(provider.query);
    await this.page.getByRole('button', { name: /Cari Penyedia/ }).click();
    const providerCheckbox = this.page.locator(
      `input[name="rekananList[${provider.index}].rkn_id"]`
    );
    await providerCheckbox.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: `Centang penyedia ${provider.query}`,
      action: 'Pilih',
      target: providerCheckbox,
      expected: 'Penyedia target ditandai.'
    });
    await providerCheckbox.check();
    await this.clickSave();
    await this.page.getByText(
      'Berhasil simpan draft Penyedia',
      { exact: false }
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
    await this.clickBack();
  }

  async approveIntegrityPact() {
    const agreementForm = this.page.locator('#form-persetujuan');
    if (!await agreementForm.isVisible({ timeout: 15000 }).catch(() => false)) {
      // The member-name links on the edit page open approval history; they do
      // not open the Pakta Integritas form. A missing form therefore means the
      // current member has either approved already or package setup is invalid.
      await this.verifyCurrentMemberAlreadyApproved();
      return;
    }
    await this.page.getByRole('heading', { name: /PAKTA INTEGRITAS/i }).waitFor({
      state: 'visible',
      timeout: 15000
    });
    const agreeButton = this.page.getByRole('button', {
      name: 'Setuju',
      exact: true
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik Setuju pada Pakta Integritas',
      target: agreeButton,
      expected: 'Persetujuan anggota Pokja tercatat.'
    });
    await agreeButton.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await agreementForm.waitFor({
      state: 'hidden',
      timeout: 30000
    }).catch(async () => {
      await this.page.getByText('Status', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: 15000
      });
    });
  }

  async verifyCurrentMemberAlreadyApproved() {
    const profileLink = this.page.locator(
      'a[href*="access-management"]'
    ).first();
    const profileText = (await profileLink.textContent())
      ?.replace(/\s+/g, ' ').trim();
    const memberName = profileText?.split(/\s+-\s+POKJA/i)[0]?.trim();
    if (!memberName) {
      throw new Error(
        'Form Pakta Integritas tidak tersedia dan nama anggota Pokja tidak ditemukan.'
      );
    }

    const approvalRow = this.page.locator('#main table tr')
      .filter({ hasText: memberName }).last();
    await approvalRow.waitFor({
      state: 'visible',
      timeout: 15000
    });
    const approvalText = (await approvalRow.textContent())
      ?.replace(/\s+/g, ' ').trim();
    if (!/\d{1,2}\s+\p{L}+\s+\d{4}/u.test(approvalText || '')) {
      const availableActions = await this.page.locator(
        '#main button, #main a'
      ).evaluateAll((elements) => elements
        .filter((element) => element.offsetParent !== null)
        .map((element) => (element.innerText || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean));
      const memberActions = await this.page.locator(
        '#main button, #main a'
      ).filter({ hasText: memberName }).evaluateAll((elements) => elements.map(
        (element) => ({
          tag: element.tagName,
          text: (element.innerText || '').replace(/\s+/g, ' ').trim(),
          href: element.getAttribute('href'),
          id: element.id,
          className: element.className,
        })
      ));
      const formsAndInputs = await this.page.locator(
        '#main form, #main input'
      ).evaluateAll((elements) => elements.map((element) => ({
        tag: element.tagName,
        type: element.getAttribute('type'),
        name: element.getAttribute('name'),
        value: element.getAttribute('value'),
        action: element.getAttribute('action'),
        id: element.id,
      })));
      const dialogText = await this.page.locator(
        '.modal-dialog, .ui-dialog, [role="dialog"]'
      ).allTextContents();
      throw new Error(
        `Form Setuju tidak tersedia, tetapi persetujuan ${memberName} juga belum tercatat. `
        + `Aksi anggota: ${JSON.stringify(memberActions)}. `
        + `Form/input: ${JSON.stringify(formsAndInputs)}. `
        + `Dialog: ${JSON.stringify(dialogText)}. `
        + `Aksi yang tersedia: ${availableActions.join(' | ')}`
      );
    }
  }

  async setVisibleFileInput(documentPath) {
    if (!fs.existsSync(documentPath)) {
      throw new Error(`Dokumen upload tidak ditemukan: ${documentPath}`);
    }
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.waitFor({
      state: 'attached',
      timeout: 15000
    });
    await fileInput.setInputFiles(documentPath);
  }

  async clickSave() {
    await this.page.getByRole('button', { name: /Simpan/ }).first().click();
  }

  async clickBack() {
    await this.page.getByRole('link', { name: /Kembali/ }).first().click();
  }
}

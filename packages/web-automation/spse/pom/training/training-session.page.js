import { captureGuideStep } from '../../utils/guide-capture.js';

export class TrainingSessionPage {
  constructor(page) {
    this.page = page;
  }

  async gotoWithServerRecovery(url, expectedLocator, description) {
    const attempts = 3;
    const failures = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', }).catch((error) => {
        failures.push(`percobaan ${attempt}: ${error.message}`);
        return null;
      });
      const serverError = await this.page.getByRole('heading', { name: /Ups! Ada yang Tidak Beres di Pihak Kami/i, }).isVisible({ timeout: 1000 }).catch(() => false);
      const expectedVisible = !serverError && await expectedLocator.isVisible({ timeout: 5000, }).catch(() => false);
      if (expectedVisible) {
        return;
      }
      const bodyText = (await this.page.locator('body').innerText()
        .catch(() => '')).replace(/\s+/g, ' ').trim();
      failures.push(
        `percobaan ${attempt}: HTTP ${response?.status() || '-'}, `
        + `url ${this.page.url()}, ${bodyText.slice(0, 240)}`
      );
      if (attempt < attempts) {
        await this.page.waitForTimeout(attempt * 1000);
      }
    }
    throw new Error(
      `${description} tidak tersedia setelah ${attempts} percobaan. `
      + failures.join(' | ')
    );
  }

  async activateAndSetTime(sessionNumber, dateTime, { stageName = 'tahap pengadaan yang sedang diuji', } = {}) {
    if (!Number.isInteger(sessionNumber) || sessionNumber <= 0) {
      throw new Error('Nomor sesi pelatihan harus berupa bilangan bulat positif.');
    }
    if (!/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(dateTime)) {
      throw new Error(
        `Format waktu sesi tidak valid: "${dateTime}". Gunakan DD-MM-YYYY HH:mm.`
      );
    }

    const baseUrl = new URL(this.page.url()).origin;
    const sessionLabel = `Sesi #${sessionNumber}`;
    const sessionSelect = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: sessionLabel }), }).first();
    await this.gotoWithServerRecovery(
      `${baseUrl}/spse/training/sesipelatihanpilih`,
      sessionSelect,
      'Halaman pemilihan sesi pelatihan'
    );
    await captureGuideStep(this.page, {
      instruction: `Pilih ${sessionLabel}`,
      action: 'Pilih',
      target: sessionSelect,
      expected: `${sessionLabel} menjadi sesi pelatihan aktif.`,
    });
    await sessionSelect.selectOption({ label: sessionLabel });
    const selectedSession = (await sessionSelect.locator(
      'option:checked'
    ).textContent())?.trim();
    if (selectedSession !== sessionLabel) {
      throw new Error(
        `Sesi pelatihan gagal dipilih. Aktual: ${selectedSession || '-'}.`
      );
    }
    await this.page.getByRole('button', {
      name: 'Pilih',
      exact: true,
    }).click();

    const changeTimeUrl = `${baseUrl}/spse/training/ubahwaktu?id=${sessionNumber}`;
    const dateInput = this.page.locator('#trainer-date-input');
    await this.gotoWithServerRecovery(
      changeTimeUrl,
      dateInput,
      `Form waktu Sesi #${sessionNumber}`
    );
    const currentDateTime = (await dateInput.inputValue()).trim();
    if (currentDateTime !== dateTime) {
      await captureGuideStep(this.page, {
        instruction: `Ubah waktu Sesi #${sessionNumber} menjadi ${dateTime} WIB`,
        action: 'Isi',
        target: dateInput,
        expected: `Waktu sesi berada dalam ${stageName}.`,
      });
      await dateInput.fill(dateTime);
      await this.page.getByRole('button', {
        name: 'Ubah',
        exact: true,
      }).click();
    }

    // Muat ulang form dari server agar validasi tidak hanya membaca nilai
    // lokal yang baru saja diisikan oleh Playwright.
    await this.gotoWithServerRecovery(
      changeTimeUrl,
      dateInput,
      `Validasi waktu Sesi #${sessionNumber}`
    );
    const storedDateTime = (await this.page.locator(
      '#trainer-date-input'
    ).inputValue()).trim();
    if (storedDateTime !== dateTime) {
      throw new Error(
        `Waktu Sesi #${sessionNumber} belum tersimpan. `
        + `Diharapkan ${dateTime}, aktual ${storedDateTime || '-'}.`
      );
    }

    const activeSessionLink = this.page.getByRole('link', {
      name: `Sesi Pelatihan: ${sessionLabel}`,
      exact: true,
    });
    await this.gotoWithServerRecovery(
      `${baseUrl}/spse/`,
      activeSessionLink,
      `Beranda dengan Sesi #${sessionNumber} aktif`
    );
  }
}

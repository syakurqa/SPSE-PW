import { captureGuideStep } from '../../utils/guide-capture.js';

export class TrainingSessionPage {
  constructor(page) {
    this.page = page;
  }

  async activateAndSetTime(sessionNumber, dateTime) {
    const baseUrl = new URL(this.page.url()).origin;
    await this.page.goto(
      `${baseUrl}/spse/training/sesipelatihanpilih`,
      { waitUntil: 'domcontentloaded' }
    );
    const sessionSelect = this.page.locator('select').first();
    await captureGuideStep(this.page, {
      instruction: `Pilih Sesi #${sessionNumber}`,
      action: 'Pilih',
      target: sessionSelect,
      expected: `Sesi #${sessionNumber} menjadi sesi pelatihan aktif.`,
    });
    await sessionSelect.selectOption({ label: `Sesi #${sessionNumber}` });
    await this.page.getByRole('button', {
      name: 'Pilih',
      exact: true,
    }).click();

    await this.page.goto(
      `${baseUrl}/spse/training/ubahwaktu?id=${sessionNumber}`,
      { waitUntil: 'domcontentloaded' }
    );
    const dateInput = this.page.locator('#trainer-date-input');
    await captureGuideStep(this.page, {
      instruction: `Ubah waktu Sesi #${sessionNumber} menjadi ${dateTime} WIB`,
      action: 'Isi',
      target: dateInput,
      expected: 'Waktu sesi berada dalam tahap Pemberian Penjelasan.',
    });
    await dateInput.fill(dateTime);
    await this.page.getByRole('button', {
      name: 'Ubah',
      exact: true,
    }).click();

    await this.page.goto(`${baseUrl}/spse/`, { waitUntil: 'domcontentloaded', });
    await this.page.getByRole('link', {
      name: `Sesi Pelatihan: Sesi #${sessionNumber}`,
      exact: true,
    }).waitFor({
      state: 'visible',
      timeout: 30000
    });
  }
}

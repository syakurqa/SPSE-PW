import { captureGuideStep } from '../../utils/guide-capture.js';
import fs from 'fs';

export class ExplanationPage {
  constructor(page) {
    this.page = page;
  }

  async openFromPackage() {
    const explanationLink = this.page.getByRole('link', { name: /Pertanyaan\s+\d+\s+dan Penjelasan\s+\d+/, });
    await captureGuideStep(this.page, {
      instruction: 'Buka tab Pertanyaan dan Penjelasan',
      target: explanationLink,
      expected: 'Forum Pemberian Penjelasan paket terbuka.',
    });
    await explanationLink.click();
    await this.page.getByText('Pemberian Penjelasan').or(
      this.page.getByText('Penjelasan Lelang')
    ).first().waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async sendQuestion(question, number) {
    const sendLink = this.page.getByRole('link', {
      name: 'Kirim Pertanyaan',
      exact: true,
    });
    await captureGuideStep(this.page, {
      instruction: `Klik Kirim Pertanyaan untuk pertanyaan ${number}`,
      target: sendLink,
      expected: 'Form pertanyaan terbuka.',
    });
    await sendLink.click();
    const dialog = this.page.locator('.modal.show, [role="dialog"]:visible')
      .last();
    await dialog.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await dialog.locator('#dokumen').fill(question.document);
    await dialog.locator('#bab').fill(question.chapter);
    await dialog.locator('#uraian').fill(question.text, { force: true });
    if (question.attachment) {
      await dialog.locator('input[type="file"]#file').setInputFiles(
        question.attachment
      );
      await dialog.locator('#path1').waitFor({
        state: 'attached',
        timeout: 30000,
      });
      await this.page.waitForTimeout(1500);
    }
    const sendButton = dialog.locator('#kirimButton');
    await captureGuideStep(this.page, {
      instruction: `Kirim pertanyaan ${number}`,
      target: sendButton,
      expected: `Pertanyaan ${number} tersimpan pada forum.`,
    });
    await sendButton.click();
    await dialog.waitFor({
      state: 'hidden',
      timeout: 30000
    });
  }

  async readCounters() {
    const counter = this.page.getByRole('link', { name: /Pertanyaan\s+\d+\s+dan Penjelasan\s+\d+/, }).first();
    const text = (await counter.textContent()) || '';
    const match = text.match(
      /Pertanyaan\s+(\d+)\s+dan\s*Penjelasan\s+(\d+)/i
    );
    if (!match) {
      throw new Error(`Counter Pertanyaan/Penjelasan tidak dikenali: ${text}`);
    }
    return {
      questions: Number(match[1]),
      explanations: Number(match[2]),
    };
  }

  async sendNextAnswer(answer, number) {
    const answerLink = this.page.getByRole('link', {
      name: 'Jawab',
      exact: true,
    }).first();
    await answerLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: `Klik Jawab untuk pertanyaan ${number}`,
      target: answerLink,
      expected: 'Editor jawaban Pokja ditampilkan.',
    });
    await answerLink.click();

    const answerForm = this.page.locator('form').filter({ has: this.page.locator('textarea[name="penjelasan.dsl_uraian"]'), }).filter({ has: this.page.locator('button#save') }).first();
    const answerInput = answerForm.locator(
      'textarea[name="penjelasan.dsl_uraian"]'
    );
    await answerInput.waitFor({
      state: 'attached',
      timeout: 15000
    });
    await answerInput.fill(answer, { force: true });
    const sendButton = answerForm.locator('button#save');
    await captureGuideStep(this.page, {
      instruction: `Kirim penjelasan untuk pertanyaan ${number}`,
      target: sendButton,
      expected: `Penjelasan ${number} tersimpan dan counter bertambah.`,
    });
    await sendButton.click();
    await answerInput.waitFor({
      state: 'detached',
      timeout: 30000
    });
  }

  async verifyAttachmentDownloads(expectedCount, roleLabel) {
    const attachmentLinks = this.page.locator('a[href^="/spse/dl/"]');
    await attachmentLinks.nth(expectedCount - 1).waitFor({
      state: 'visible',
      timeout: 30000,
    }).catch(() => null);
    const availableCount = await attachmentLinks.count();
    if (availableCount < expectedCount) {
      throw new Error(
        `${roleLabel} hanya menemukan ${availableCount} lampiran; `
        + `diharapkan minimal ${expectedCount}.`
      );
    }

    const downloads = [];
    for (let index = 0; index < expectedCount; index++) {
      const attachmentLink = attachmentLinks.nth(index);
      await captureGuideStep(this.page, {
        instruction: `${roleLabel} mengunduh lampiran ${index + 1}`,
        action: 'Download',
        target: attachmentLink,
        expected: 'File selesai diunduh dan tidak kosong.',
      });
      const [download] = await Promise.all([
        this.page.waitForEvent('download', { timeout: 30000 }),
        attachmentLink.click(),
      ]);
      const failure = await download.failure();
      if (failure) {
        throw new Error(
          `Download lampiran ${index + 1} oleh ${roleLabel} gagal: ${failure}`
        );
      }
      const downloadedPath = await download.path();
      if (!downloadedPath || !fs.existsSync(downloadedPath)) {
        throw new Error(
          `File lampiran ${index + 1} hasil download ${roleLabel} tidak ditemukan.`
        );
      }
      const size = fs.statSync(downloadedPath).size;
      if (size <= 0) {
        throw new Error(
          `File lampiran ${index + 1} hasil download ${roleLabel} kosong.`
        );
      }
      downloads.push({
        fileName: download.suggestedFilename(),
        size,
      });
    }
    return downloads;
  }
}

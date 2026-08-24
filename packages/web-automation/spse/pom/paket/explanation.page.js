import { captureGuideStep } from '../../utils/guide-capture.js';
import fs from 'fs';
import path from 'path';

export class ExplanationPage {
  constructor(page) {
    this.page = page;
  }

  async openFromPackage() {
    const explanationLink = this.page.getByRole('link', { name: /Pertanyaan\s+\d+\s+dan Penjelasan\s+\d+/, }).first();
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

  async hasStoredQuestion(question) {
    return this.getQuestionPanel(question).isVisible({ timeout: 1000 })
      .catch(() => false);
  }

  async hasStoredAnswer(question, answer) {
    if (!await this.hasStoredQuestion(question)) {
      return false;
    }
    return this.getQuestionPanel(question).getByText(answer, { exact: true })
      .isVisible({ timeout: 1000 }).catch(() => false);
  }

  async ensureQuestion(question, label) {
    if (await this.hasStoredQuestion(question)) {
      return {
        created: false,
        counters: await this.readCounters(),
      };
    }
    return {
      created: true,
      counters: await this.sendQuestion(question, label),
    };
  }

  async sendQuestion(question, label) {
    const countersBefore = await this.readCounters();
    const number = label || countersBefore.questions + 1;
    const expectedQuestionCount = countersBefore.questions + 1;
    const sendLink = this.page.getByRole('link', {
      name: 'Kirim Pertanyaan',
      exact: true,
    }).first();
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
      if (!fs.existsSync(question.attachment)
        || fs.statSync(question.attachment).size <= 0) {
        throw new Error(
          `Lampiran pertanyaan ${number} tidak ditemukan atau kosong: `
          + question.attachment
        );
      }
      const fileInput = dialog.locator('input[type="file"]#file');
      await fileInput.setInputFiles(question.attachment);
      const selectedName = await fileInput.evaluate(
        (element) => element.files?.[0]?.name || ''
      );
      if (selectedName !== path.basename(question.attachment)) {
        throw new Error(
          `File pertanyaan ${number} tidak terpasang pada input upload.`
        );
      }
      await this.waitForUploadReady(dialog, question.attachment, number);
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
    return this.waitForQuestionStored(question, expectedQuestionCount);
  }

  async waitForUploadReady(dialog, attachmentPath, number) {
    const fileName = path.basename(attachmentPath);
    const uploadStateHandle = await this.page.waitForFunction(
      ({ expectedFileName }) => {
        const isVisible = (element) => {
          const style = window.getComputedStyle(element);
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && element.getClientRects().length > 0;
        };
        const dialogs = Array.from(document.querySelectorAll(
          '.modal.show, [role="dialog"]'
        )).filter(isVisible);
        const activeDialog = dialogs.at(-1);
        if (!activeDialog) {
          return null;
        }

        const errorText = Array.from(activeDialog.querySelectorAll(
          '.alert-danger, .text-danger, .invalid-feedback'
        )).filter(isVisible).map((element) => element.textContent || '')
          .join(' ').replace(/\s+/g, ' ').trim();
        if (errorText) {
          return {
            state: 'error',
            detail: errorText,
          };
        }

        const uploadMarkers = Array.from(activeDialog.querySelectorAll(
          'input[type="hidden"], #path1, #fileId, #fileId1'
        )).filter((element) => /path|file.?id/i.test(
          `${element.id} ${element.getAttribute('name') || ''}`
        ));
        const marker = uploadMarkers.map((element) => (
          element.value
          || element.getAttribute('value')
          || element.textContent
          || ''
        ).trim()).find((value) => value
          && !/^(?:0|null|undefined)$/i.test(value));
        const successText = Array.from(activeDialog.querySelectorAll(
          '.alert-success, .text-success'
        )).filter(isVisible).map((element) => element.textContent || '')
          .join(' ').replace(/\s+/g, ' ').trim();
        if (marker || (successText
          && new RegExp(`berhasil|selesai|${expectedFileName}`, 'i')
            .test(successText))) {
          return {
            state: 'ready',
            detail: marker || successText,
          };
        }
        return null;
      },
      { expectedFileName: fileName },
      { timeout: 45000 }
    );
    const uploadState = await uploadStateHandle.jsonValue();
    if (uploadState?.state !== 'ready') {
      throw new Error(
        `Upload lampiran pertanyaan ${number} gagal: `
        + (uploadState?.detail || 'status upload tidak dikenali')
      );
    }
    await dialog.locator('#kirimButton').waitFor({
      state: 'visible',
      timeout: 15000,
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

  getQuestionPanel(question) {
    // Pertanyaan dan jawaban dirender sebagai dua <li> bersaudara di dalam
    // satu list. Scope ke parent list agar aksi Jawab/Download tetap spesifik
    // pada pertanyaan, sekaligus jawaban yang baru tersimpan dapat divalidasi.
    return this.page.locator('li:visible').filter({ hasText: question.text, }).first()
      .locator('xpath=parent::*');
  }

  async waitForQuestionStored(question, expectedQuestionCount = null) {
    const panel = this.getQuestionPanel(question);
    await panel.waitFor({
      state: 'visible',
      timeout: 30000,
    });
    if (question.attachment) {
      await panel.locator('a[href^="/spse/dl/"]').first().waitFor({
        state: 'visible',
        timeout: 30000,
      });
    }
    if (expectedQuestionCount !== null) {
      await this.waitForCounter({ questions: expectedQuestionCount, });
    }
    return this.readCounters();
  }

  async verifyStoredQuestions(questions) {
    for (const question of questions) {
      await this.waitForQuestionStored(question);
    }
  }

  async ensureAnswer(question, answer, label) {
    if (await this.hasStoredAnswer(question, answer)) {
      return {
        created: false,
        counters: await this.readCounters(),
      };
    }
    return {
      created: true,
      counters: await this.sendAnswer(question, answer, label),
    };
  }

  async sendAnswer(question, answer, label) {
    const countersBefore = await this.readCounters();
    const number = label || countersBefore.explanations + 1;
    const expectedExplanationCount = countersBefore.explanations + 1;
    const questionPanel = this.getQuestionPanel(question);
    await questionPanel.waitFor({
      state: 'visible',
      timeout: 30000,
    });
    const answerLink = questionPanel.getByRole('link', {
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

    const answerForm = questionPanel.locator('form').filter({
      has: this.page.locator(
        'textarea[name="penjelasan.dsl_uraian"]'
      ),
    }).filter({ has: this.page.locator('button#save'), }).first();
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
    await questionPanel.getByText(answer, { exact: true }).waitFor({
      state: 'visible',
      timeout: 30000,
    });
    await this.waitForCounter({
      questions: countersBefore.questions,
      explanations: expectedExplanationCount,
    });
    return this.readCounters();
  }

  async verifyStoredAnswers(questions, answers, answeredCount) {
    for (let index = 0; index < answeredCount; index++) {
      const panel = this.getQuestionPanel(questions[index]);
      await panel.getByText(answers[index], { exact: true }).waitFor({
        state: 'visible',
        timeout: 30000,
      });
    }
  }

  async waitForCounter({ questions, explanations }) {
    await this.page.waitForFunction(
      ({ expectedQuestions, expectedExplanations }) => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.some((link) => {
          const match = (link.textContent || '').replace(/\s+/g, ' ').match(
            /Pertanyaan\s+(\d+)\s+dan\s*Penjelasan\s+(\d+)/i
          );
          if (!match || Number(match[1]) !== expectedQuestions) {
            return false;
          }
          return expectedExplanations === null
            || Number(match[2]) === expectedExplanations;
        });
      },
      {
        expectedQuestions: questions,
        expectedExplanations: explanations ?? null,
      },
      { timeout: 30000 }
    );
  }

  async verifyAttachmentDownloads(questions, roleLabel) {
    const downloads = [];
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];
      const questionPanel = this.getQuestionPanel(question);
      await questionPanel.waitFor({
        state: 'visible',
        timeout: 30000,
      });
      const attachmentLink = questionPanel.locator(
        'a[href^="/spse/dl/"]'
      ).first();
      await attachmentLink.waitFor({
        state: 'visible',
        timeout: 30000,
      });
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
        document: question.document,
        chapter: question.chapter,
        fileName: download.suggestedFilename(),
        size,
      });
    }
    return downloads;
  }
}

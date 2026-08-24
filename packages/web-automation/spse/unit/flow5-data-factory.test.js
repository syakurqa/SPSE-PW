import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'path';
import { createFlow5Data, flow5Data } from '../fixtures/data/flow5.data.js';

test('Flow 5 factory mempertahankan nilai default dan export lama', () => {
  const data = createFlow5Data({}, {});

  assert.equal(data.sessionNumber, 25);
  assert.equal(data.explanationTime, '23-08-2026 10:00');
  assert.equal(data.questions.length, 5);
  assert.equal(data.answers.length, 5);
  assert.equal(
    data.questions.filter((question) => question.attachment).length,
    2
  );
  assert.deepEqual(flow5Data, createFlow5Data());
});

test('Flow 5 factory membaca override environment untuk sesi dan jumlah data', () => {
  const attachmentFile = './fixtures/flow5-attachment.zip';
  const data = createFlow5Data({}, {
    SPSE_FLOW5_SESSION_NUMBER: '31',
    SPSE_FLOW5_EXPLANATION_TIME: '30-08-2026 13:45',
    SPSE_FLOW5_QUESTION_COUNT: '3',
    SPSE_FLOW5_ATTACHMENT_COUNT: '1',
    SPSE_FLOW5_ATTACHMENT_FILE: attachmentFile,
  });

  assert.equal(data.sessionNumber, 31);
  assert.equal(data.explanationTime, '30-08-2026 13:45');
  assert.equal(data.questions.length, 3);
  assert.equal(data.answers.length, 3);
  assert.equal(data.questions[0].attachment, path.resolve(attachmentFile));
  assert.equal(data.questions[1].attachment, undefined);
});

test('Flow 5 factory memberi prioritas pada override eksplisit', () => {
  const data = createFlow5Data({
    sessionNumber: 40,
    questionCount: 2,
    attachmentCount: 0,
  }, {
    SPSE_FLOW5_SESSION_NUMBER: '41',
    SPSE_FLOW5_QUESTION_COUNT: '4',
    SPSE_FLOW5_ATTACHMENT_COUNT: '2',
  });

  assert.equal(data.sessionNumber, 40);
  assert.equal(data.questions.length, 2);
  assert.equal(
    data.questions.filter((question) => question.attachment).length,
    0
  );
});

test('Flow 5 factory menolak pasangan pertanyaan dan jawaban yang tidak lengkap', () => {
  assert.throws(() => createFlow5Data({
    questions: [{
      document: 'Dokumen',
      chapter: 'Bab',
      text: 'Pertanyaan?',
    }],
    answers: [],
  }, {}), /Jumlah questions dan answers Flow 5 harus sama/);
});

test('Flow 5 factory menolak jumlah dan waktu yang tidak valid', () => {
  assert.throws(
    () => createFlow5Data({ questionCount: 6 }, {}),
    /questionCount Flow 5/
  );
  assert.throws(
    () => createFlow5Data({ explanationTime: '31-02-2026 10:00' }, {}),
    /bukan tanggal dan waktu yang valid/
  );
  assert.throws(
    () => createFlow5Data({ attachmentCount: 6 }, {}),
    /attachmentCount Flow 5/
  );
});

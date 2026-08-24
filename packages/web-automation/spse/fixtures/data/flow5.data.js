import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultAttachmentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);

const DEFAULT_QUESTIONS = [
  {
    document: 'Dokumen Pemilihan',
    chapter: 'Ruang Lingkup dan Kuantitas Barang',
    text: 'Mohon dijelaskan rincian jenis Bahan Reagent, ukuran kemasan, jumlah kebutuhan, serta alat pemeriksaan yang harus kompatibel untuk setiap item agar Penyedia dapat menyusun penawaran secara tepat.',
    attachment: defaultAttachmentPath,
  },
  {
    document: 'Spesifikasi Teknis',
    chapter: 'Mutu, Masa Simpan, dan Penyimpanan',
    text: 'Mohon dikonfirmasi standar mutu, dokumen produk, ketentuan produk setara, sisa masa kedaluwarsa minimum, serta kondisi penyimpanan Bahan Reagent yang wajib dipenuhi pada saat serah terima.',
    attachment: defaultAttachmentPath,
  },
  {
    document: 'Dokumen Pemilihan',
    chapter: 'Jadwal dan Mekanisme Pengiriman',
    text: 'Apakah pengiriman Bahan Reagent dilakukan sekaligus atau bertahap, di lokasi mana barang diserahterimakan, dan apakah terdapat persyaratan khusus terkait suhu atau rantai dingin selama distribusi?',
  },
  {
    document: 'Persyaratan Kualifikasi',
    chapter: 'Perizinan dan Pengalaman Sejenis',
    text: 'Mohon dijelaskan dokumen perizinan usaha atau distribusi yang harus masih berlaku serta bukti pengalaman pengadaan Bahan Reagent atau barang sejenis yang dapat digunakan dalam evaluasi kualifikasi.',
  },
  {
    document: 'Rancangan Kontrak',
    chapter: 'Pemeriksaan, Penggantian, dan Pembayaran',
    text: 'Mohon dijelaskan prosedur pemeriksaan saat barang diterima, batas waktu penggantian untuk Bahan Reagent yang rusak, tidak sesuai, atau tidak memenuhi masa simpan, serta dokumen yang menjadi dasar pembayaran.',
  },
];

const DEFAULT_ANSWERS = [
  'Jenis, ukuran kemasan, jumlah, dan tujuan penggunaan setiap Bahan Reagent mengikuti daftar kuantitas serta spesifikasi teknis paket. Penyedia harus menawarkan seluruh item yang dipersyaratkan dan memastikan kompatibilitasnya dengan alat pemeriksaan yang disebutkan. Bukti kompatibilitas berupa brosur, katalog, atau pernyataan produsen harus dilampirkan apabila diminta dalam dokumen pemilihan.',
  'Setiap Bahan Reagent wajib memenuhi standar mutu dan persyaratan produk dalam dokumen pemilihan. Produk setara dapat ditawarkan hanya apabila karakteristik serta fungsinya dapat dibuktikan setara melalui brosur, data teknis, sertifikat analisis, atau dokumen produk yang relevan. Sisa masa kedaluwarsa dan kondisi penyimpanan pada saat serah terima harus mengikuti batas minimum serta petunjuk produsen yang dipersyaratkan.',
  'Pengiriman mengikuti lokasi dan jadwal pada dokumen pemilihan atau surat pesanan. Pengiriman bertahap hanya dapat dilakukan jika dinyatakan atau disetujui oleh Pejabat Pembuat Komitmen. Penyedia tetap bertanggung jawab menjaga kondisi kemasan dan suhu selama distribusi, termasuk menggunakan rantai dingin dan catatan pemantauan suhu apabila jenis Reagent yang dikirim memang mensyaratkannya.',
  'Dokumen perizinan usaha atau distribusi harus sesuai dengan bidang barang yang ditawarkan, masih berlaku, dan dapat diverifikasi. Bukti pengalaman sejenis dinilai berdasarkan dokumen kontrak, pesanan, dan serah terima yang sah dalam periode yang ditentukan. Apabila dokumen pemilihan tidak mewajibkan pengalaman tertentu, evaluasi tetap mengacu pada persyaratan kualifikasi yang tercantum di sistem.',
  'Pada saat penerimaan, petugas memeriksa jumlah, jenis, kemasan, nomor bets, masa kedaluwarsa, kondisi penyimpanan, dan kesesuaian spesifikasi Bahan Reagent. Barang yang rusak, tidak sesuai, atau tidak memenuhi ketentuan masa simpan wajib diganti oleh Penyedia dalam batas waktu pada kontrak tanpa biaya tambahan. Pembayaran diproses setelah barang dinyatakan diterima dan dokumen tagihan, faktur, berita acara, serta dokumen pendukung lainnya dinyatakan lengkap.',
];

const ALLOWED_OVERRIDE_KEYS = new Set([
  'sessionNumber',
  'explanationTime',
  'questions',
  'answers',
  'questionCount',
  'attachmentCount',
  'attachmentFile',
]);

function readEnvironment(environment, name) {
  const value = environment?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseInteger(value, label, { minimum, maximum }) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${label} harus berupa bilangan bulat antara ${minimum} dan ${maximum}.`
    );
  }
  return parsed;
}

function validateTrainingDateTime(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} harus menggunakan format DD-MM-YYYY HH:mm.`);
  }
  const match = value.match(
    /^(\d{2})-(\d{2})-(\d{4})\s(\d{2}):(\d{2})$/
  );
  if (!match) {
    throw new Error(`${label} harus menggunakan format DD-MM-YYYY HH:mm.`);
  }
  const [, day, month, year, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute) {
    throw new Error(`${label} bukan tanggal dan waktu yang valid: ${value}.`);
  }
  return value;
}

function normalizeUploadPath(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} harus berupa path file PDF atau ZIP.`);
  }
  const resolvedPath = path.resolve(value.trim());
  if (!/\.(?:pdf|zip)$/i.test(resolvedPath)) {
    throw new Error(`${label} harus menggunakan file PDF atau ZIP.`);
  }
  return resolvedPath;
}

function validateQuestion(question, index) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    throw new Error(`Pertanyaan ${index + 1} harus berupa object.`);
  }
  for (const field of ['document', 'chapter', 'text']) {
    if (typeof question[field] !== 'string' || !question[field].trim()) {
      throw new Error(`Pertanyaan ${index + 1}.${field} wajib diisi.`);
    }
  }
  return {
    document: question.document.trim(),
    chapter: question.chapter.trim(),
    text: question.text.trim(),
    ...(question.attachment
      ? {
        attachment: normalizeUploadPath(
          question.attachment,
          `Pertanyaan ${index + 1}.attachment`
        ),
      }
      : {}),
  };
}

function validateAnswer(answer, index) {
  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error(`Jawaban ${index + 1} wajib diisi.`);
  }
  return answer.trim();
}

function validateOverrideKeys(overrides) {
  const unknownKeys = Object.keys(overrides).filter(
    (key) => !ALLOWED_OVERRIDE_KEYS.has(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(`Override Flow 5 tidak dikenali: ${unknownKeys.join(', ')}.`);
  }
}

/**
 * Membuat data Flow 5 yang dapat dioverride tanpa mengubah spec.
 * Override eksplisit memiliki prioritas lebih tinggi daripada environment.
 *
 * Environment yang didukung:
 * SPSE_FLOW5_SESSION_NUMBER, SPSE_FLOW5_EXPLANATION_TIME,
 * SPSE_FLOW5_QUESTION_COUNT, SPSE_FLOW5_ATTACHMENT_COUNT, dan
 * SPSE_FLOW5_ATTACHMENT_FILE.
 */
export function createFlow5Data(overrides = {}, environment = process.env) {
  validateOverrideKeys(overrides);
  const sourceQuestions = overrides.questions ?? DEFAULT_QUESTIONS;
  const sourceAnswers = overrides.answers ?? DEFAULT_ANSWERS;
  if (!Array.isArray(sourceQuestions) || !Array.isArray(sourceAnswers)) {
    throw new Error('questions dan answers Flow 5 harus berupa array.');
  }
  if (sourceQuestions.length !== sourceAnswers.length) {
    throw new Error(
      'Jumlah questions dan answers Flow 5 harus sama agar setiap pertanyaan memiliki jawaban.'
    );
  }

  const validatedQuestions = sourceQuestions.map(validateQuestion);
  const validatedAnswers = sourceAnswers.map(validateAnswer);
  const questionCount = parseInteger(
    overrides.questionCount
      ?? readEnvironment(environment, 'SPSE_FLOW5_QUESTION_COUNT')
      ?? validatedQuestions.length,
    'questionCount Flow 5',
    {
      minimum: 1,
      maximum: validatedQuestions.length,
    }
  );
  let questions = validatedQuestions.slice(0, questionCount);
  const answers = validatedAnswers.slice(0, questionCount);

  const attachmentCountValue = overrides.attachmentCount
    ?? readEnvironment(environment, 'SPSE_FLOW5_ATTACHMENT_COUNT');
  const attachmentFileValue = overrides.attachmentFile
    ?? readEnvironment(environment, 'SPSE_FLOW5_ATTACHMENT_FILE');
  if (attachmentCountValue !== undefined) {
    const attachmentCount = parseInteger(
      attachmentCountValue,
      'attachmentCount Flow 5',
      {
        minimum: 0,
        maximum: questionCount,
      }
    );
    const attachmentFile = normalizeUploadPath(
      attachmentFileValue ?? defaultAttachmentPath,
      'attachmentFile Flow 5'
    );
    questions = questions.map((question, index) => {
      const normalizedQuestion = { ...question };
      if (index < attachmentCount) {
        normalizedQuestion.attachment = attachmentFile;
      } else {
        delete normalizedQuestion.attachment;
      }
      return normalizedQuestion;
    });
  } else if (attachmentFileValue !== undefined) {
    const attachmentFile = normalizeUploadPath(
      attachmentFileValue,
      'attachmentFile Flow 5'
    );
    questions = questions.map((question) => question.attachment
      ? {
        ...question,
        attachment: attachmentFile,
      }
      : question);
  }

  return {
    sessionNumber: parseInteger(
      overrides.sessionNumber
        ?? readEnvironment(environment, 'SPSE_FLOW5_SESSION_NUMBER')
        ?? 25,
      'sessionNumber Flow 5',
      {
        minimum: 1,
        maximum: 9999,
      }
    ),
    explanationTime: validateTrainingDateTime(
      overrides.explanationTime
        ?? readEnvironment(environment, 'SPSE_FLOW5_EXPLANATION_TIME')
        ?? '23-08-2026 10:00',
      'explanationTime Flow 5'
    ),
    questions,
    answers,
  };
}

// Export lama dipertahankan agar seluruh spec yang ada tetap kompatibel.
export const flow5Data = createFlow5Data();

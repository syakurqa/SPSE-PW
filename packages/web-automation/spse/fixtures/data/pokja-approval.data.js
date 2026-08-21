import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const documentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);

const resumableStatuses = new Set([
  'SENT_TO_POKJA',
  'POKJA_1_APPROVED',
  'POKJA_2_APPROVED',
  'POKJA_APPROVED',
]);

function readCredential(index) {
  const username = process.env[`SPSE_POKJA_${index}_USERNAME`];
  const password = process.env[`SPSE_POKJA_${index}_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `SPSE_POKJA_${index}_USERNAME dan SPSE_POKJA_${index}_PASSWORD wajib dikonfigurasi.`
    );
  }
  return {
    index,
    label: `Pokja ${index}`,
    username,
    password,
  };
}

export function loadPokjaApprovalData({ manifestPath } = {}) {
  if (!manifestPath) {
    throw new Error(
      'SPSE_PACKAGE_MANIFEST wajib menunjuk manifest paket yang telah menyelesaikan Flow 2.'
    );
  }

  const resolvedManifestPath = path.resolve(manifestPath);
  if (!fs.existsSync(resolvedManifestPath)) {
    throw new Error(`Manifest paket tidak ditemukan: ${resolvedManifestPath}`);
  }

  const manifest = JSON.parse(
    fs.readFileSync(resolvedManifestPath, 'utf8')
  );
  if (manifest.packageType !== 'Non-Tender'
    || manifest.metodePemilihan !== 'Penunjukan Langsung') {
    throw new Error(
      'Flow 3 hanya mendukung paket Non-Tender dengan metode Penunjukan Langsung.'
    );
  }
  if (!resumableStatuses.has(manifest.status)) {
    throw new Error(
      `Status manifest "${manifest.status}" tidak dapat dipakai Flow 3.`
    );
  }
  if (!manifest.packageId || !manifest.packageName) {
    throw new Error(
      'Manifest Flow 3 wajib memiliki packageId dan packageName.'
    );
  }
  if (!fs.existsSync(documentPath)) {
    throw new Error(`Dokumen data test tidak ditemukan: ${documentPath}`);
  }
  const isGoods = manifest.jenisPengadaan === 'Pengadaan Barang';
  const requiresKbki = manifest.requiresKbki === true;

  return {
    manifest,
    manifestPath: resolvedManifestPath,
    members: [1, 2, 3].map(readCredential),
    schedule: {
      firstDayOffset: 1,
      stageCount: 9,
      startHour: 8,
      endHour: 16,
    },
    businessQualification: 'Kecil',
    qualification: {
      source: 'KBLI',
      query: 'makan',
      classification: /1075\s*-\s*Industri Makanan/i,
      administrativeIndexes: isGoods ? [4] : [4, 5],
      // Pengadaan Barang biasa tidak otomatis membutuhkan persyaratan
      // pengalaman/KBKI. Skenario khusus dapat mengisi kedua nilai ini
      // secara eksplisit bila dokumen pemilihannya memang mensyaratkan KBKI.
      technicalIndexes: isGoods ? [] : [0, 1, 2, 3, 4],
      kbkiQuery: requiresKbki ? 'b' : null,
    },
    offerValidityDays: 90,
    offerDocument: {
      administrativeIndexes: [2],
      requirementIndexes: [0, 1, 3, 4, 5, 6],
      priceIndexes: [0, 1],
    },
    sdpNumber: '123',
    invitation: {
      place: 'Gedung LKPP',
      equipment: 'LAPTOP',
      attendees: 'SELURUH BOD',
    },
    provider: {
      query: 'ANGSAE',
      index: 0,
    },
    documents: {
      sdp: documentPath,
      invitation: documentPath,
      minutes: documentPath,
    },
  };
}

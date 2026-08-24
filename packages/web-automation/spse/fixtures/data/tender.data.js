import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const documentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);
const counterPath = path.resolve(
  __dirname,
  '../../../../../.tender-counter.json'
);

const supportedSelectionMethods = [
  'Tender',
  'Tender Cepat',
  'Seleksi',
];

function nextPackageSequence() {
  let sequence = 1;
  try {
    if (fs.existsSync(counterPath)) {
      const current = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
      sequence = Number(current.paketCount || 0) + 1;
    }
    fs.writeFileSync(
      counterPath,
      JSON.stringify({ paketCount: sequence }, null, 2)
    );
  } catch {
    // Timestamp pada nama paket tetap menjaga keunikan jika counter gagal.
  }
  return sequence;
}

export function createTenderTestData({
  metodeLabel = 'Tender',
  satkerQuery = 'DINAS LINGKUNGAN HIDUP',
  rupIndex = 1,
} = {}) {
  if (!supportedSelectionMethods.includes(metodeLabel)) {
    throw new Error(
      `Metode Tender tidak didukung fixture: ${metodeLabel}`
    );
  }
  return {
    selection: {
      tahun: '2026',
      satkerQuery,
      metodeLabel,
      rupIndex,
    },
    package: {
      createName: (selectedRup) => {
        const sequence = nextPackageSequence();
        return `[QA] [${selectedRup.metodeLabel}] [Automation] [${sequence}] - ${selectedRup.nama} - ${Date.now()}`;
      },
      kbkiItems: [
        {
          jenisBarang: 'pipa',
          satuan: 'pcs',
          harga: '1000000',
          keterangan: 'Pipa',
          query: 'pipa',
          selectText: 'Pipa/ slang kain',
        },
        {
          jenisBarang: 'selang kain',
          satuan: 'pcs',
          harga: '1000000',
          keterangan: 'Selang kain',
          query: 'pipa',
          selectText: 'Pipa/ slang kain',
        },
      ],
    },
    documents: {
      preparation: documentPath,
      notaDinasPpk: documentPath,
    },
  };
}

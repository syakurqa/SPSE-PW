import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const documentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);
const counterPath = path.resolve(__dirname, '../../../../../.counter.json');

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
    // Nama paket tetap unik melalui timestamp jika counter tidak dapat ditulis.
  }
  return String(sequence).padStart(3, '0');
}

const supportedSelectionMethods = [
  'Pengadaan Langsung',
  'Penunjukan Langsung',
];

const procurementTypeLabels = {
  'Pengadaan Barang': 'Pengadaan Barang',
  'Pekerjaan Konstruksi': 'Pekerjaan Konstruksi',
  'Jasa Konsultasi': 'Jasa Konsultansi',
  'Jasa Konsultansi': 'Jasa Konsultansi',
  'Jasa Lainnya': 'Jasa Lainnya',
};

export function createNonTenderTestData({
  metodeLabel = 'Penunjukan Langsung',
  jenisPengadaanLabel = 'Pekerjaan Konstruksi',
  satkerQuery = 'DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN',
  rupName = 'Belanja Jasa Survey Kajian Potensi Parkir di Wilayah Kota Cirebon',
  rupIndex = 1,
} = {}) {
  const sequence = nextPackageSequence();
  if (!supportedSelectionMethods.includes(metodeLabel)) {
    throw new Error(
      `Metode pemilihan tidak didukung fixture: ${metodeLabel}`
    );
  }
  const normalizedProcurementType = procurementTypeLabels[
    jenisPengadaanLabel
  ];
  if (!normalizedProcurementType) {
    throw new Error(
      `Jenis pengadaan tidak didukung fixture: ${jenisPengadaanLabel}`
    );
  }

  return {
    selection: {
      tahun: '2026',
      satkerQuery,
      metodeLabel,
      jenisPengadaanLabel: normalizedProcurementType,
      rupName,
      rupIndex,
    },
    package: {
      createName: (selectedRup) =>
        `[QA] [${selectedRup.metodeLabel}] [Automation] [${sequence}] - ${selectedRup.nama} - ${Date.now()}`,
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
          harga: '01000000',
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

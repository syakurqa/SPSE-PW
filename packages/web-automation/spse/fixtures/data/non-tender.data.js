import crypto from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const documentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);
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

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} wajib berupa string yang tidak kosong.`);
  }
  return value.trim();
}

function validateKbkiItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('kbkiItems wajib berupa array dengan minimal satu item HPS.');
  }
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`kbkiItems[${index}] wajib berupa object.`);
    }
    if (!Number.isFinite(item.harga) || item.harga <= 0) {
      throw new Error(`kbkiItems[${index}].harga wajib berupa number positif.`);
    }
    return {
      jenisBarang: requireText(
        item.jenisBarang,
        `kbkiItems[${index}].jenisBarang`
      ),
      satuan: requireText(item.satuan, `kbkiItems[${index}].satuan`),
      harga: item.harga,
      keterangan: requireText(
        item.keterangan,
        `kbkiItems[${index}].keterangan`
      ),
      query: requireText(item.query, `kbkiItems[${index}].query`),
      selectText: requireText(
        item.selectText,
        `kbkiItems[${index}].selectText`
      ),
    };
  });
}

export function createNonTenderTestData({
  metodeLabel = 'Penunjukan Langsung',
  jenisPengadaanLabel = 'Pekerjaan Konstruksi',
  satkerQuery = 'DINAS PERUMAHAN RAKYAT DAN KAWASAN PERMUKIMAN',
  rupName = 'Belanja Jasa Survey Kajian Potensi Parkir di Wilayah Kota Cirebon',
  rupIndex = 1,
  minimumPagu = null,
  tahun = '2026',
  kbkiItems,
  preparationDocument = documentPath,
  notaDinasDocument = documentPath,
  requiresKbki = null,
  packageNamePrefix = '[QA] [Automation]',
  runId = crypto.randomUUID().slice(0, 8),
} = {}) {
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

  if (!Number.isInteger(rupIndex) || rupIndex < 1) {
    throw new Error('rupIndex harus berupa urutan RUP mulai dari 1.');
  }
  if (minimumPagu !== null
    && (!Number.isFinite(minimumPagu) || minimumPagu < 0)) {
    throw new Error('minimumPagu harus berupa angka non-negatif atau null.');
  }
  if (requiresKbki !== null && typeof requiresKbki !== 'boolean') {
    throw new Error('requiresKbki harus berupa boolean atau null.');
  }
  const normalizedRequiresKbki = requiresKbki
    ?? normalizedProcurementType !== 'Pengadaan Barang';

  const normalizedSatker = requireText(satkerQuery, 'satkerQuery');
  const normalizedYear = requireText(tahun, 'tahun');
  const normalizedPrefix = requireText(packageNamePrefix, 'packageNamePrefix');
  const normalizedPreparationDocument = requireText(
    preparationDocument,
    'preparationDocument'
  );
  const normalizedNotaDinasDocument = requireText(
    notaDinasDocument,
    'notaDinasDocument'
  );
  if (rupName !== null && (typeof rupName !== 'string' || !rupName.trim())) {
    throw new Error('rupName harus berupa string tidak kosong atau null.');
  }

  const configuredKbkiItems = kbkiItems || [
    {
      jenisBarang: 'pipa',
      satuan: 'pcs',
      harga: 1_000_000,
      keterangan: 'Pipa',
      query: 'pipa',
      selectText: 'Pipa/ slang kain',
    },
    {
      jenisBarang: 'selang kain',
      satuan: 'pcs',
      harga: 1_000_000,
      keterangan: 'Selang kain',
      query: 'pipa',
      selectText: 'Pipa/ slang kain',
    },
  ];

  const normalizedKbkiItems = validateKbkiItems(configuredKbkiItems);

  return {
    selection: {
      tahun: normalizedYear,
      satkerQuery: normalizedSatker,
      metodeLabel,
      jenisPengadaanLabel: normalizedProcurementType,
      rupName: rupName?.trim() || null,
      rupIndex,
      minimumPagu,
    },
    package: {
      createName: (selectedRup) =>
        `${normalizedPrefix} [${selectedRup.metodeLabel}] [${runId}] - ${selectedRup.nama}`,
      kbkiItems: normalizedKbkiItems,
      requiresKbki: normalizedRequiresKbki,
    },
    documents: {
      preparation: normalizedPreparationDocument,
      notaDinasPpk: normalizedNotaDinasDocument,
    },
  };
}

export function createHealthGoodsDirectAppointmentData(overrides = {}) {
  return createNonTenderTestData({
    satkerQuery: 'DINAS KESEHATAN',
    metodeLabel: 'Penunjukan Langsung',
    jenisPengadaanLabel: 'Pengadaan Barang',
    rupName: null,
    rupIndex: 1,
    minimumPagu: 10_000_000_000,
    requiresKbki: true,
    kbkiItems: [{
      jenisBarang: 'Pipa',
      satuan: 'paket',
      harga: 10_000_000_000,
      keterangan: 'Nilai HPS pengadaan barang Rp10 miliar',
      query: 'pipa',
      selectText: 'Pipa/ slang kain',
    }],
    ...overrides,
  });
}

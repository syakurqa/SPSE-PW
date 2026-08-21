import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDocument = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);

export const flow6Data = {
  sessionNumber: 25,
  offerTime: '24-08-2026 10:00',
  qualification: {
    // Gunakan 'all' untuk semua data, atau array indeks seperti [0]
    // untuk hanya memilih data pertama pada kelompok tersebut.
    businessPermits: 'all',
    personnel: 'all',
    experience: 'all',
    ongoingWork: 'all',
    equipment: 'all',
    otherRequirementFile: testDocument,
  },
  offer: {
    validityDays: 90,
    technicalFile: testDocument,
    // Setiap elemen dipakai berurutan untuk persyaratan lampiran harga.
    // Gunakan null pada indeks tertentu jika lampiran tersebut tidak ingin diunggah.
    priceRequirementFiles: [testDocument, testDocument],
    // DPP Rp9 miliar + PPN 11% = Rp9,99 miliar, masih <= HPS Rp10 miliar.
    priceBeforeVat: 9000000000,
    vatPercent: 11,
    tkdnPercent: 20,
  },
};

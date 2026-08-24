import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readPackageManifest } from '../../utils/package-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const documentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);

export function loadUkpbjApprovalData({
  manifestPath,
  pokjaName,
  pokjaIndex = 1,
} = {}) {
  if (!manifestPath) {
    throw new Error(
      'SPSE_PACKAGE_MANIFEST wajib menunjuk manifest Flow 1 secara eksplisit.'
    );
  }

  const resolvedManifestPath = path.resolve(manifestPath);
  if (!fs.existsSync(resolvedManifestPath)) {
    throw new Error(
      `Manifest Flow 1 tidak ditemukan: ${resolvedManifestPath}`
    );
  }
  const manifest = readPackageManifest(resolvedManifestPath, {
    allowedStatuses: ['SENT_TO_UKPBJ'],
    requiredFields: ['packageUrl'],
  });
  const expectedValues = {
    packageType: 'Non-Tender',
    metodePemilihan: 'Penunjukan Langsung',
    assignedRole: 'Kepala UKPBJ',
    status: 'SENT_TO_UKPBJ',
  };
  for (const [field, expected] of Object.entries(expectedValues)) {
    if (manifest[field] !== expected) {
      throw new Error(
        `Manifest tidak dapat dipakai Flow 2. ${field} diharapkan "${expected}", aktual "${manifest[field]}".`
      );
    }
  }
  if (!fs.existsSync(documentPath)) {
    throw new Error(`Dokumen penugasan Pokja tidak ditemukan: ${documentPath}`);
  }

  return {
    manifest,
    manifestPath: resolvedManifestPath,
    pokja: {
      name: pokjaName || null,
      index: Number(pokjaIndex),
    },
    documents: { assignment: documentPath, },
  };
}

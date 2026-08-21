import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultManifestDir = path.resolve(
  __dirname,
  '../runtime/packages'
);

export function writePackageManifest(manifest, outputPath) {
  const requiredFields = [
    'packageId',
    'packageName',
    'packageType',
    'metodePemilihan',
    'satker',
    'assignedRole',
    'status',
  ];
  const missingFields = requiredFields.filter((field) => !manifest[field]);
  if (missingFields.length > 0) {
    throw new Error(
      `Manifest paket tidak lengkap: ${missingFields.join(', ')}`
    );
  }

  const targetPath = outputPath
    ? path.resolve(outputPath)
    : path.join(defaultManifestDir, `${manifest.packageId}.json`);
  const tempPath = `${targetPath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(
    tempPath,
    JSON.stringify({
      schemaVersion: 1,
      ...manifest
    }, null, 2)
  );
  fs.renameSync(tempPath, targetPath);
  return targetPath;
}

export function updatePackageManifest(manifestPath, updates) {
  const targetPath = path.resolve(manifestPath);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Manifest paket tidak ditemukan: ${targetPath}`);
  }
  const currentManifest = JSON.parse(
    fs.readFileSync(targetPath, 'utf8')
  );
  return writePackageManifest(
    {
      ...currentManifest,
      ...updates
    },
    targetPath
  );
}

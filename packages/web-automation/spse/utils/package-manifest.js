import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultManifestDir = path.resolve(
  __dirname,
  '../runtime/packages'
);

export const PACKAGE_MANIFEST_SCHEMA_VERSION = 2;

/**
 * Status yang membentuk alur paket Flow 1 sampai Flow 6.
 *
 * Status di luar daftar ini tetap dapat dibaca dan diperbarui melalui API lama
 * agar manifest Flow berikutnya tetap kompatibel. API transisi yang ketat hanya
 * menerima status yang didefinisikan di sini.
 */
export const PACKAGE_STATUS = Object.freeze({
  SENT_TO_UKPBJ: 'SENT_TO_UKPBJ',
  SENT_TO_PROCUREMENT_OFFICER: 'SENT_TO_PROCUREMENT_OFFICER',
  SENT_TO_POKJA: 'SENT_TO_POKJA',
  POKJA_1_APPROVED: 'POKJA_1_APPROVED',
  POKJA_2_APPROVED: 'POKJA_2_APPROVED',
  POKJA_APPROVED: 'POKJA_APPROVED',
  ACCEPTED_BY_PROVIDER: 'ACCEPTED_BY_PROVIDER',
  FLOW5_PROVIDER_QUESTIONS_SENT: 'FLOW5_PROVIDER_QUESTIONS_SENT',
  FLOW5_EXPLANATION_COMPLETED: 'FLOW5_EXPLANATION_COMPLETED',
  FLOW6_QUALIFICATION_SENT: 'FLOW6_QUALIFICATION_SENT',
  FLOW6_OFFER_LETTER_SENT: 'FLOW6_OFFER_LETTER_SENT',
  FLOW6_TECHNICAL_SENT: 'FLOW6_TECHNICAL_SENT',
  FLOW6_PRICE_SAVED: 'FLOW6_PRICE_SAVED',
  FLOW6_SUBMISSION_COMPLETED: 'FLOW6_SUBMISSION_COMPLETED',
});

const knownStatuses = new Set(Object.values(PACKAGE_STATUS));
const allowedHistoryTypes = new Set([
  'created',
  'updated',
  'transitioned',
]);

export const PACKAGE_STATUS_TRANSITIONS = Object.freeze({
  [PACKAGE_STATUS.SENT_TO_UKPBJ]: Object.freeze([
    PACKAGE_STATUS.SENT_TO_POKJA,
  ]),
  [PACKAGE_STATUS.SENT_TO_PROCUREMENT_OFFICER]: Object.freeze([]),
  [PACKAGE_STATUS.SENT_TO_POKJA]: Object.freeze([
    PACKAGE_STATUS.POKJA_1_APPROVED,
  ]),
  [PACKAGE_STATUS.POKJA_1_APPROVED]: Object.freeze([
    PACKAGE_STATUS.POKJA_2_APPROVED,
  ]),
  [PACKAGE_STATUS.POKJA_2_APPROVED]: Object.freeze([
    PACKAGE_STATUS.POKJA_APPROVED,
  ]),
  [PACKAGE_STATUS.POKJA_APPROVED]: Object.freeze([
    PACKAGE_STATUS.ACCEPTED_BY_PROVIDER,
  ]),
  [PACKAGE_STATUS.ACCEPTED_BY_PROVIDER]: Object.freeze([
    PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT,
  ]),
  [PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT]: Object.freeze([
    PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED,
  ]),
  [PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED]: Object.freeze([
    PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT,
  ]),
  [PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT]: Object.freeze([
    PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT,
  ]),
  [PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT]: Object.freeze([
    PACKAGE_STATUS.FLOW6_TECHNICAL_SENT,
  ]),
  [PACKAGE_STATUS.FLOW6_TECHNICAL_SENT]: Object.freeze([
    PACKAGE_STATUS.FLOW6_PRICE_SAVED,
  ]),
  [PACKAGE_STATUS.FLOW6_PRICE_SAVED]: Object.freeze([
    PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
  ]),
  [PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED]: Object.freeze([]),
});

const baseRequiredFields = Object.freeze([
  'packageId',
  'packageName',
  'packageType',
  'metodePemilihan',
  'satker',
  'assignedRole',
  'status',
]);

const reservedUpdateFields = new Set([
  'schemaVersion',
  'revision',
  'history',
]);

export class ManifestValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ManifestValidationError';
  }
}

export class ManifestConflictError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ManifestConflictError';
  }
}

export class ManifestTransitionError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ManifestTransitionError';
  }
}

export function isKnownPackageStatus(status) {
  return knownStatuses.has(status);
}

function assertManifestObject(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new ManifestValidationError(
      'Manifest paket harus berupa object JSON.'
    );
  }
}

function validateHistory(history, revision, status, { requireCompleteHistory = false, } = {}) {
  if (!Array.isArray(history)) {
    throw new ManifestValidationError('history manifest harus berupa array.');
  }

  let previousRevision = 0;
  for (const [index, entry] of history.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ManifestValidationError(
        `history[${index}] manifest harus berupa object.`
      );
    }
    if (!Number.isInteger(entry.revision) || entry.revision < 1) {
      throw new ManifestValidationError(
        `history[${index}].revision harus berupa bilangan bulat positif.`
      );
    }
    if (entry.revision !== previousRevision + 1) {
      throw new ManifestValidationError(
        'Revision pada history manifest harus berurutan tanpa celah.'
      );
    }
    if (typeof entry.status !== 'string' || !entry.status.trim()) {
      throw new ManifestValidationError(
        `history[${index}].status wajib berupa string yang tidak kosong.`
      );
    }
    if (!allowedHistoryTypes.has(entry.type)) {
      throw new ManifestValidationError(
        `history[${index}].type tidak valid: ${entry.type}`
      );
    }
    if (typeof entry.at !== 'string' || !entry.at.trim()) {
      throw new ManifestValidationError(
        `history[${index}].at wajib berupa timestamp ISO.`
      );
    }
    let normalizedTimestamp;
    try {
      normalizedTimestamp = new Date(entry.at).toISOString();
    } catch {
      normalizedTimestamp = null;
    }
    if (normalizedTimestamp !== entry.at) {
      throw new ManifestValidationError(
        `history[${index}].at wajib berupa timestamp ISO canonical.`
      );
    }
    if (!Array.isArray(entry.changes)
      || entry.changes.length === 0
      || entry.changes.some((field) => (
        typeof field !== 'string' || !field.trim()
      ))) {
      throw new ManifestValidationError(
        `history[${index}].changes wajib berupa array nama field.`
      );
    }
    const normalizedChanges = [...new Set(entry.changes)].sort();
    if (JSON.stringify(normalizedChanges) !== JSON.stringify(entry.changes)) {
      throw new ManifestValidationError(
        `history[${index}].changes wajib unik dan terurut.`
      );
    }
    for (const optionalTextField of ['actor', 'reason']) {
      if (Object.hasOwn(entry, optionalTextField)
        && (typeof entry[optionalTextField] !== 'string'
          || !entry[optionalTextField].trim())) {
        throw new ManifestValidationError(
          `history[${index}].${optionalTextField} wajib berupa string yang tidak kosong.`
        );
      }
    }
    if (entry.type === 'created') {
      if (index !== 0 || entry.revision !== 1
        || Object.hasOwn(entry, 'fromStatus')
        || !entry.changes.includes('status')) {
        throw new ManifestValidationError(
          'History created hanya boleh menjadi revision pertama tanpa fromStatus dan wajib mencatat status.'
        );
      }
    } else {
      if (typeof entry.fromStatus !== 'string' || !entry.fromStatus.trim()) {
        throw new ManifestValidationError(
          `history[${index}].fromStatus wajib untuk ${entry.type}.`
        );
      }
      if (index > 0 && entry.fromStatus !== history[index - 1].status) {
        throw new ManifestValidationError(
          `history[${index}].fromStatus tidak sama dengan status revision sebelumnya.`
        );
      }
    }
    if (entry.type === 'transitioned' && !entry.changes.includes('status')) {
      throw new ManifestValidationError(
        `history[${index}] bertipe transitioned wajib mencatat perubahan status.`
      );
    }
    if (entry.type === 'updated' && entry.status !== entry.fromStatus) {
      throw new ManifestValidationError(
        `history[${index}] bertipe updated tidak boleh mengubah status.`
      );
    }
    if (entry.type === 'transitioned'
      && isKnownPackageStatus(entry.fromStatus)
      && isKnownPackageStatus(entry.status)
      && entry.fromStatus !== entry.status
      && !PACKAGE_STATUS_TRANSITIONS[entry.fromStatus]?.includes(
        entry.status
      )) {
      throw new ManifestValidationError(
        `Transisi history tidak diizinkan: ${entry.fromStatus} -> ${entry.status}`
      );
    }
    previousRevision = entry.revision;
  }

  if (history.length > 0 && previousRevision !== revision) {
    throw new ManifestValidationError(
      `Revision manifest (${revision}) tidak sama dengan revision history terakhir (${previousRevision}).`
    );
  }
  if (history.length > 0 && history.at(-1).status !== status) {
    throw new ManifestValidationError(
      `Status manifest (${status}) tidak sama dengan status history terakhir (${history.at(-1).status}).`
    );
  }
  if (requireCompleteHistory && history.length !== revision) {
    throw new ManifestValidationError(
      `Manifest schema v2 wajib memiliki satu history untuk setiap revision. Revision ${revision}, history ${history.length}.`
    );
  }
}

/**
 * Memvalidasi sekaligus menormalisasi manifest dari disk atau pemanggil.
 * Manifest schema v1 tanpa revision/history diperlakukan sebagai legacy dan
 * diberi revision 0 di memory; update berikutnya akan memigrasikannya ke v2.
 */
export function validatePackageManifest(manifest, {
  allowUnknownStatus = true,
  allowedStatuses = [],
  requiredFields = [],
} = {}) {
  assertManifestObject(manifest);

  if (!Array.isArray(allowedStatuses) || !Array.isArray(requiredFields)) {
    throw new ManifestValidationError(
      'allowedStatuses dan requiredFields wajib berupa array.'
    );
  }
  const fieldsToValidate = [...new Set([
    ...baseRequiredFields,
    ...requiredFields,
  ])];
  const missingFields = fieldsToValidate.filter((field) => (
    typeof manifest[field] !== 'string' || !manifest[field].trim()
  ));
  if (missingFields.length > 0) {
    throw new ManifestValidationError(
      `Manifest paket tidak lengkap: ${missingFields.join(', ')}`
    );
  }

  if (allowedStatuses.length > 0
    && !allowedStatuses.includes(manifest.status)) {
    throw new ManifestValidationError(
      `Status manifest tidak diizinkan. Diharapkan ${allowedStatuses.join(' atau ')}, aktual ${manifest.status}.`
    );
  }
  if (allowedStatuses.length === 0
    && !allowUnknownStatus
    && !isKnownPackageStatus(manifest.status)) {
    throw new ManifestValidationError(
      `Status manifest tidak dikenal untuk Flow 1-6: ${manifest.status}`
    );
  }

  const schemaVersion = manifest.schemaVersion ?? 1;
  if (![1, PACKAGE_MANIFEST_SCHEMA_VERSION].includes(schemaVersion)) {
    throw new ManifestValidationError(
      `schemaVersion manifest tidak didukung: ${schemaVersion}`
    );
  }

  const sourceHistory = manifest.history === undefined
    ? []
    : manifest.history;
  if (!Array.isArray(sourceHistory)) {
    throw new ManifestValidationError('history manifest harus berupa array.');
  }
  const history = [...sourceHistory];
  const revision = manifest.revision === undefined
    ? (history.at(-1)?.revision ?? 0)
    : manifest.revision;
  if (!Number.isInteger(revision) || revision < 0) {
    throw new ManifestValidationError(
      'revision manifest harus berupa bilangan bulat non-negatif.'
    );
  }
  if (schemaVersion === PACKAGE_MANIFEST_SCHEMA_VERSION && revision < 1) {
    throw new ManifestValidationError(
      'Manifest schema v2 wajib memiliki revision minimal 1.'
    );
  }
  validateHistory(history, revision, manifest.status, {
    requireCompleteHistory:
      schemaVersion === PACKAGE_MANIFEST_SCHEMA_VERSION,
  });

  return {
    ...manifest,
    schemaVersion,
    revision,
    history,
  };
}

function parseManifest(targetPath, options) {
  if (!fs.existsSync(targetPath)) {
    throw new ManifestValidationError(
      `Manifest paket tidak ditemukan: ${targetPath}`
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    throw new ManifestValidationError(
      `Manifest paket bukan JSON yang valid: ${targetPath}`,
      { cause: error }
    );
  }
  return validatePackageManifest(manifest, options);
}

export function readPackageManifest(manifestPath, options = {}) {
  if (!manifestPath || typeof manifestPath !== 'string') {
    throw new ManifestValidationError(
      'Path manifest paket wajib berupa string yang tidak kosong.'
    );
  }
  return parseManifest(path.resolve(manifestPath), options);
}

function writeJsonAtomically(targetPath, manifest) {
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2));
    fs.renameSync(tempPath, targetPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function withManifestLock(targetPath, operation) {
  const lockPath = `${targetPath}.lock`;
  let lockDescriptor;
  try {
    lockDescriptor = fs.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new ManifestConflictError(
        `Manifest sedang diperbarui proses lain: ${targetPath}`,
        { cause: error }
      );
    }
    throw error;
  }

  try {
    return operation();
  } finally {
    fs.closeSync(lockDescriptor);
    fs.unlinkSync(lockPath);
  }
}

function historyEntry({
  revision,
  type,
  status,
  fromStatus,
  changes,
  actor,
  reason,
}) {
  return {
    revision,
    type,
    status,
    ...(fromStatus === undefined ? {} : { fromStatus }),
    at: new Date().toISOString(),
    changes: [...new Set(changes)].sort(),
    ...(actor ? { actor } : {}),
    ...(reason ? { reason } : {}),
  };
}

function assertUpdates(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new ManifestValidationError('Updates manifest harus berupa object.');
  }
  const reservedFields = Object.keys(updates).filter((field) => (
    reservedUpdateFields.has(field)
  ));
  if (reservedFields.length > 0) {
    throw new ManifestValidationError(
      `Field metadata manifest tidak boleh diubah langsung: ${reservedFields.join(', ')}`
    );
  }
}

function nextManifest(currentManifest, updates, {
  actor,
  reason,
  historyType,
} = {}) {
  assertUpdates(updates);
  const revision = currentManifest.revision + 1;
  const status = updates.status ?? currentManifest.status;
  const next = {
    ...currentManifest,
    ...updates,
    schemaVersion: PACKAGE_MANIFEST_SCHEMA_VERSION,
    revision,
  };
  const entry = historyEntry({
    revision,
    type: historyType || (
      status === currentManifest.status ? 'updated' : 'transitioned'
    ),
    status,
    fromStatus: currentManifest.status,
    changes: Object.keys(updates),
    actor,
    reason,
  });
  next.history = [...currentManifest.history, entry];
  return validatePackageManifest(next);
}

/**
 * API kompatibel untuk membuat manifest baru. Nilai kembali tetap berupa path.
 */
export function writePackageManifest(manifest, outputPath) {
  const cleanManifest = { ...manifest };
  delete cleanManifest.schemaVersion;
  delete cleanManifest.revision;
  delete cleanManifest.history;

  const initialManifest = validatePackageManifest({
    ...cleanManifest,
    schemaVersion: PACKAGE_MANIFEST_SCHEMA_VERSION,
    revision: 1,
    history: [historyEntry({
      revision: 1,
      type: 'created',
      status: cleanManifest.status,
      changes: Object.keys(cleanManifest),
    })],
  });
  const targetPath = outputPath
    ? path.resolve(outputPath)
    : path.join(defaultManifestDir, `${initialManifest.packageId}.json`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  withManifestLock(targetPath, () => {
    writeJsonAtomically(targetPath, initialManifest);
  });
  return targetPath;
}

/**
 * API kompatibel untuk patch bebas. Nilai kembali tetap berupa path. Setiap
 * patch kini menaikkan revision dan menambahkan audit history.
 */
export function updatePackageManifest(manifestPath, updates) {
  const targetPath = path.resolve(manifestPath);
  assertUpdates(updates);
  return withManifestLock(targetPath, () => {
    const currentManifest = parseManifest(targetPath);
    const updatedManifest = nextManifest(currentManifest, updates);
    writeJsonAtomically(targetPath, updatedManifest);
    return targetPath;
  });
}

function normalizeExpectedStatuses(expectedStatus) {
  const statuses = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  if (statuses.length === 0 || statuses.some((status) => (
    typeof status !== 'string' || !status.trim()
  ))) {
    throw new ManifestValidationError(
      'expectedStatus wajib berupa status atau array status yang tidak kosong.'
    );
  }
  return statuses;
}

function assertAllowedTransition(currentStatus, nextStatus) {
  if (!isKnownPackageStatus(nextStatus)) {
    throw new ManifestTransitionError(
      `Status tujuan tidak dikenal untuk Flow 1-6: ${nextStatus}`
    );
  }
  if (currentStatus === nextStatus) {
    return;
  }
  const allowedStatuses = PACKAGE_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedStatuses.includes(nextStatus)) {
    throw new ManifestTransitionError(
      `Transisi manifest tidak diizinkan: ${currentStatus} -> ${nextStatus}`
    );
  }
}

/**
 * Mengubah status dengan compare-and-set terhadap status dan, bila diberikan,
 * revision. Berbeda dari updatePackageManifest, fungsi ini menegakkan urutan
 * status Flow 1-6 dan mengembalikan manifest terbaru.
 */
export function transitionPackageManifest(manifestPath, {
  from,
  to,
  expectedStatus,
  expectedRevision,
  nextStatus,
  updates = {},
  actor,
  reason,
} = {}) {
  const targetPath = path.resolve(manifestPath);
  const expectedStatuses = normalizeExpectedStatuses(from ?? expectedStatus);
  const targetStatus = to ?? nextStatus;
  assertUpdates(updates);
  if (Object.hasOwn(updates, 'status') && updates.status !== targetStatus) {
    throw new ManifestValidationError(
      'updates.status harus sama dengan nextStatus atau tidak disertakan.'
    );
  }

  return withManifestLock(targetPath, () => {
    const currentManifest = parseManifest(
      targetPath,
      { allowUnknownStatus: false }
    );
    if (!expectedStatuses.includes(currentManifest.status)) {
      throw new ManifestConflictError(
        `Status manifest berubah. Diharapkan ${expectedStatuses.join(' atau ')}, aktual ${currentManifest.status}.`
      );
    }
    if (expectedRevision !== undefined
      && currentManifest.revision !== expectedRevision) {
      throw new ManifestConflictError(
        `Revision manifest berubah. Diharapkan ${expectedRevision}, aktual ${currentManifest.revision}.`
      );
    }
    assertAllowedTransition(currentManifest.status, targetStatus);

    const transitionedManifest = nextManifest(
      currentManifest,
      {
        ...updates,
        status: targetStatus
      },
      {
        actor,
        reason,
        historyType: 'transitioned'
      }
    );
    writeJsonAtomically(targetPath, transitionedManifest);
    return transitionedManifest;
  });
}

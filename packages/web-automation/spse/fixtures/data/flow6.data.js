import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultTestDocument = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);

const QUALIFICATION_KEYS = [
  'businessPermits',
  'personnel',
  'experience',
  'ongoingWork',
  'equipment',
];
const ALLOWED_OVERRIDE_KEYS = new Set([
  'sessionNumber',
  'offerTime',
  'qualification',
  'offer',
]);
const ALLOWED_QUALIFICATION_KEYS = new Set([
  ...QUALIFICATION_KEYS,
  'otherRequirementFile',
]);
const ALLOWED_OFFER_KEYS = new Set([
  'validityDays',
  'technicalFile',
  'priceRequirementFiles',
  'priceBeforeVat',
  'vatPercent',
  'tkdnPercent',
]);
const ALLOWED_TECHNICAL_FILE_KEYS = new Set([
  'defaultFile',
  'byRequirementId',
  'byRequirementName',
]);

function readEnvironment(environment, name) {
  const value = environment?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function definedEntries(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function parseNumber(value, label, {
  minimum,
  maximum,
  integer = false,
}) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)
    || (integer && !Number.isInteger(parsed))
    || parsed < minimum
    || parsed > maximum) {
    const type = integer ? 'bilangan bulat' : 'angka';
    throw new Error(
      `${label} harus berupa ${type} antara ${minimum} dan ${maximum}.`
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

function normalizeTechnicalFileMap(value, label) {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} harus berupa object pemetaan path file.`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, file]) => {
    if (!key.trim()) {
      throw new Error(`${label} tidak boleh memiliki key kosong.`);
    }
    return [key, normalizeUploadPath(file, `${label}.${key}`)];
  }));
}

function normalizeTechnicalFileConfig(value, label) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^[{[]/.test(normalized)) {
      try {
        return normalizeTechnicalFileConfig(JSON.parse(normalized), label);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(
            `${label} JSON tidak valid: ${error.message}`
          );
        }
        throw error;
      }
    }
    return normalizeUploadPath(normalized, label);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error(`${label} array tidak boleh kosong.`);
    }
    return value.map((file, index) => normalizeUploadPath(
      file,
      `${label}[${index}]`
    ));
  }
  validateKeys(value, ALLOWED_TECHNICAL_FILE_KEYS, label);
  const config = definedEntries({
    defaultFile: value.defaultFile
      ? normalizeUploadPath(value.defaultFile, `${label}.defaultFile`)
      : undefined,
    byRequirementId: normalizeTechnicalFileMap(
      value.byRequirementId,
      `${label}.byRequirementId`
    ),
    byRequirementName: normalizeTechnicalFileMap(
      value.byRequirementName,
      `${label}.byRequirementName`
    ),
  });
  const mappedFileCount = Object.values(config).reduce((count, entry) => (
    count + (typeof entry === 'string' ? 1 : Object.keys(entry).length)
  ), 0);
  if (mappedFileCount === 0) {
    throw new Error(`${label} wajib memiliki minimal satu path file.`);
  }
  return config;
}

function parseSelection(value, label) {
  if (value === 'all') {
    return 'all';
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'all') {
      return 'all';
    }
    if (normalized === 'none' || normalized === '[]') {
      return [];
    }
    if (normalized.startsWith('[')) {
      let parsed;
      try {
        parsed = JSON.parse(normalized);
      } catch {
        throw new Error(
          `${label} harus 'all', 'none', array JSON, atau daftar indeks.`
        );
      }
      return parseSelection(parsed, label);
    }
    return parseSelection(
      normalized.split(',').map((item) => Number(item)),
      label
    );
  }
  if (!Array.isArray(value)
    || value.some((index) => !Number.isInteger(index) || index < 0)) {
    throw new Error(
      `${label} harus 'all' atau array indeks bilangan bulat non-negatif.`
    );
  }
  return [...new Set(value)];
}

function parsePriceRequirementFiles(value) {
  let files = value;
  if (typeof files === 'string') {
    const normalized = files.trim();
    if (normalized.startsWith('[')) {
      try {
        files = JSON.parse(normalized);
      } catch {
        throw new Error(
          'SPSE_FLOW6_PRICE_REQUIREMENT_FILES harus berupa array JSON atau daftar path.'
        );
      }
    } else {
      files = normalized.split(',').map((item) => item.trim());
    }
  }
  if (!Array.isArray(files)) {
    throw new Error('priceRequirementFiles harus berupa array path file atau null.');
  }
  return files.map((file, index) => {
    if (file === null
      || (typeof file === 'string'
        && /^(?:null|none|skip)$/i.test(file.trim()))) {
      return null;
    }
    return normalizeUploadPath(file, `priceRequirementFiles[${index}]`);
  });
}

function validateKeys(object, allowedKeys, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    throw new Error(`${label} harus berupa object.`);
  }
  const unknownKeys = Object.keys(object).filter(
    (key) => !allowedKeys.has(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(`${label} tidak mengenali: ${unknownKeys.join(', ')}.`);
  }
}

/**
 * Membuat data Flow 6 yang tervalidasi dan mudah dioverride QA.
 * Override eksplisit memiliki prioritas lebih tinggi daripada environment.
 *
 * Environment utama: SPSE_FLOW6_SESSION_NUMBER, SPSE_FLOW6_OFFER_TIME,
 * SPSE_FLOW6_{BUSINESS_PERMITS|PERSONNEL|EXPERIENCE|ONGOING_WORK|EQUIPMENT},
 * SPSE_FLOW6_OTHER_REQUIREMENT_FILE, SPSE_FLOW6_VALIDITY_DAYS,
 * SPSE_FLOW6_TECHNICAL_FILE, SPSE_FLOW6_PRICE_REQUIREMENT_FILES,
 * SPSE_FLOW6_PRICE_BEFORE_VAT, SPSE_FLOW6_VAT_PERCENT, dan
 * SPSE_FLOW6_TKDN_PERCENT.
 */
export function createFlow6Data(overrides = {}, environment = process.env) {
  validateKeys(overrides, ALLOWED_OVERRIDE_KEYS, 'Override Flow 6');
  const qualificationOverrides = overrides.qualification ?? {};
  const offerOverrides = overrides.offer ?? {};
  validateKeys(
    qualificationOverrides,
    ALLOWED_QUALIFICATION_KEYS,
    'Override qualification Flow 6'
  );
  validateKeys(offerOverrides, ALLOWED_OFFER_KEYS, 'Override offer Flow 6');

  const qualificationEnvironment = {
    businessPermits: readEnvironment(
      environment,
      'SPSE_FLOW6_BUSINESS_PERMITS'
    ),
    personnel: readEnvironment(environment, 'SPSE_FLOW6_PERSONNEL'),
    experience: readEnvironment(environment, 'SPSE_FLOW6_EXPERIENCE'),
    ongoingWork: readEnvironment(environment, 'SPSE_FLOW6_ONGOING_WORK'),
    equipment: readEnvironment(environment, 'SPSE_FLOW6_EQUIPMENT'),
    otherRequirementFile: readEnvironment(
      environment,
      'SPSE_FLOW6_OTHER_REQUIREMENT_FILE'
    ),
  };
  const qualificationSource = {
    businessPermits: 'all',
    personnel: 'all',
    experience: 'all',
    ongoingWork: 'all',
    equipment: 'all',
    otherRequirementFile: defaultTestDocument,
    ...definedEntries(qualificationEnvironment),
    ...qualificationOverrides,
  };
  const qualification = Object.fromEntries(
    QUALIFICATION_KEYS.map((key) => [
      key,
      parseSelection(qualificationSource[key], `qualification.${key}`),
    ])
  );
  qualification.otherRequirementFile = normalizeUploadPath(
    qualificationSource.otherRequirementFile,
    'qualification.otherRequirementFile'
  );

  const offerEnvironment = {
    validityDays: readEnvironment(environment, 'SPSE_FLOW6_VALIDITY_DAYS'),
    technicalFile: readEnvironment(environment, 'SPSE_FLOW6_TECHNICAL_FILE'),
    priceRequirementFiles: readEnvironment(
      environment,
      'SPSE_FLOW6_PRICE_REQUIREMENT_FILES'
    ),
    priceBeforeVat: readEnvironment(
      environment,
      'SPSE_FLOW6_PRICE_BEFORE_VAT'
    ),
    vatPercent: readEnvironment(environment, 'SPSE_FLOW6_VAT_PERCENT'),
    tkdnPercent: readEnvironment(environment, 'SPSE_FLOW6_TKDN_PERCENT'),
  };
  const offerSource = {
    validityDays: 90,
    technicalFile: defaultTestDocument,
    priceRequirementFiles: [defaultTestDocument, defaultTestDocument],
    priceBeforeVat: 9000000000,
    vatPercent: 11,
    tkdnPercent: 20,
    ...definedEntries(offerEnvironment),
    ...offerOverrides,
  };
  const offer = {
    validityDays: parseNumber(
      offerSource.validityDays,
      'offer.validityDays',
      {
        minimum: 1,
        maximum: 3650,
        integer: true,
      }
    ),
    technicalFile: normalizeTechnicalFileConfig(
      offerSource.technicalFile,
      'offer.technicalFile'
    ),
    priceRequirementFiles: parsePriceRequirementFiles(
      offerSource.priceRequirementFiles
    ),
    priceBeforeVat: parseNumber(
      offerSource.priceBeforeVat,
      'offer.priceBeforeVat',
      {
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
      }
    ),
    vatPercent: parseNumber(offerSource.vatPercent, 'offer.vatPercent', {
      minimum: 0,
      maximum: 100,
    }),
    tkdnPercent: parseNumber(offerSource.tkdnPercent, 'offer.tkdnPercent', {
      minimum: 0,
      maximum: 100,
    }),
  };

  return {
    sessionNumber: parseNumber(
      overrides.sessionNumber
        ?? readEnvironment(environment, 'SPSE_FLOW6_SESSION_NUMBER')
        ?? 25,
      'sessionNumber Flow 6',
      {
        minimum: 1,
        maximum: 9999,
        integer: true,
      }
    ),
    offerTime: validateTrainingDateTime(
      overrides.offerTime
        ?? readEnvironment(environment, 'SPSE_FLOW6_OFFER_TIME')
        ?? '24-08-2026 10:00',
      'offerTime Flow 6'
    ),
    qualification,
    offer,
  };
}

// Export lama dipertahankan agar seluruh spec yang ada tetap kompatibel.
export const flow6Data = createFlow6Data();

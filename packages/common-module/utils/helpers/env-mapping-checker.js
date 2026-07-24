/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.resolve(__dirname, '../../config');

const TARGETS = [
  {
    label: 'Environment',
    sit: 'env.sit.json',
    uat: 'env.uat.json'
  },
  {
    label: 'Database',
    sit: 'db.sit.json',
    uat: 'db.uat.json'
  }
];

const getType = (value) => {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
};

const compareValues = (keyPath, sitValue, uatValue, issues) => {
  const location = keyPath || '(root)';
  const sitType = getType(sitValue);
  const uatType = getType(uatValue);

  if (sitType !== uatType) {
    issues.push(`Type mismatch at ${location}: SIT is ${sitType}, UAT is ${uatType}`);
    return;
  }

  if (sitType === 'object') {
    const sitKeys = new Set(Object.keys(sitValue));
    const uatKeys = new Set(Object.keys(uatValue));

    for (const key of sitKeys) {
      const nextPath = keyPath ? `${keyPath}.${key}` : key;
      if (!uatKeys.has(key)) {
        issues.push(`Missing key in UAT at ${nextPath}`);
        continue;
      }
      compareValues(nextPath, sitValue[key], uatValue[key], issues);
    }
    for (const key of uatKeys) {
      if (!sitKeys.has(key)) {
        const nextPath = keyPath ? `${keyPath}.${key}` : key;
        issues.push(`Missing key in SIT at ${nextPath}`);
      }
    }
    return;
  }

  if (sitType === 'array') {
    if (sitValue.length !== uatValue.length) {
      issues.push(`Array length mismatch at ${location}: SIT has ${sitValue.length}, UAT has ${uatValue.length}`);
    }
    const maxLength = Math.min(sitValue.length, uatValue.length);
    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = `${location}[${index}]`;
      compareValues(nextPath, sitValue[index], uatValue[index], issues);
    }
  }
};

const loadJson = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to read JSON file ${filePath}: ${error.message}`);
  }
};

const run = () => {
  const mismatches = [];

  for (const target of TARGETS) {
    const sitPath = path.join(CONFIG_DIR, target.sit);
    const uatPath = path.join(CONFIG_DIR, target.uat);

    if (!fs.existsSync(sitPath) || !fs.existsSync(uatPath)) {
      mismatches.push({
        label: target.label,
        issues: [
          !fs.existsSync(sitPath) ? `Missing file ${sitPath}` : null,
          !fs.existsSync(uatPath) ? `Missing file ${uatPath}` : null
        ].filter(Boolean)
      });
      continue;
    }

    const sitConfig = loadJson(sitPath);
    const uatConfig = loadJson(uatPath);
    const issues = [];
    compareValues('', sitConfig, uatConfig, issues);

    if (issues.length > 0) {
      mismatches.push({
        label: target.label,
        issues
      });
    }
  }

  if (mismatches.length > 0) {
    console.error('Configuration consistency check failed:');
    for (const mismatch of mismatches) {
      console.error(`\n${mismatch.label} mismatches:`);
      mismatch.issues.forEach((issue) => {
        console.error(`  - ${issue}`);
      });
    }
    process.exit(1);
  } else {
    console.log('Environment and database configuration mappings are aligned between SIT and UAT.');
  }
};

run();

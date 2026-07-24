import fs from 'fs';
import path from 'path';
import { getFilePath } from './get-fixtures.js';

export function readJsonFixture(relativePath) {
  const absolutePath = getFilePath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');

  if (!raw.trim()) {
    return [];
  }

  return JSON.parse(raw);
}

export function appendJsonFixture(relativePath, rows) {
  const absolutePath = getFilePath(relativePath);
  let current = [];

  if (fs.existsSync(absolutePath)) {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    if (raw.trim()) {
      current = JSON.parse(raw);
    }
  }

  const next = current.concat(rows);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(next, null, 2), 'utf8');
}


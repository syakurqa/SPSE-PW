import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getFilePath(fixtureFilePath) {
  return path.join(__dirname, '../../fixtures', fixtureFilePath);
}

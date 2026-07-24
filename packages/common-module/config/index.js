import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readJsonIfExists = (fileName, fallback = {}) => {
  const fullPath = path.join(__dirname, fileName);
  if (!fs.existsSync(fullPath)) {
    return fallback;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content) {
    return fallback;
  }
  return JSON.parse(content);
};

let mobileEnv, env, db;
if (process.env.ENV === 'UAT') {
  mobileEnv = readJsonIfExists('mobile.env.uat.json', {});
  env = readJsonIfExists('env.uat.json', {});
  db = readJsonIfExists('db.uat.json', {});
} else {
  mobileEnv = readJsonIfExists('mobile.env.sit.json', {});
  env = readJsonIfExists('env.sit.json', {});
  db = readJsonIfExists('db.sit.json', {});
}
export {
  mobileEnv, env, db
};

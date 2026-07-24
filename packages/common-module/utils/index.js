import { readdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const modules = {};

const files = await readdir(__dirname);
for (const file of files) {
  if (file !== 'index.js' && file.endsWith('.js')) {
    const moduleName = file.replace('.js', '');
    const module = await import(`./${file}`);
    modules[moduleName] = module.default || module;
  }
}

export { modules };

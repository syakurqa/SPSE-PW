import { glob } from 'glob';

const modules = {};
const files = await glob('./db/*/*.js');
for (const file of files) {
  const parseFile = file.replace('db/', '').split('/');
  const folder = parseFile[0];
  const filename = parseFile[1];

  if (filename !== 'index.js' && filename.endsWith('.js')) {
    const moduleName = folder;
    const module = await import(`./${folder}/${filename}`);
    modules[moduleName] = module.default || module;
  }
}

const db = modules;
export { db };

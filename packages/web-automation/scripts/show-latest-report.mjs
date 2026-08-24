import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const reportRoot = path.join(packageDirectory, 'playwright-report');
const playwrightCli = path.resolve(
  packageDirectory,
  '../../node_modules/@playwright/test/cli.js'
);

function resolveReportDirectory(configuredPath) {
  if (configuredPath) {
    return path.resolve(configuredPath);
  }
  if (!fs.existsSync(reportRoot)) {
    throw new Error(`Folder report belum tersedia: ${reportRoot}`);
  }
  const timestampedReports = fs.readdirSync(reportRoot, { withFileTypes: true, })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(reportRoot, entry.name, 'html'))
    .filter((directory) => fs.existsSync(path.join(directory, 'index.html')));
  const candidates = [
    path.join(reportRoot, 'html'),
    ...timestampedReports,
  ].filter((directory) => fs.existsSync(path.join(directory, 'index.html')))
    .sort((left, right) => (
      fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs
    ));
  if (candidates.length === 0) {
    throw new Error(`HTML report tidak ditemukan di ${reportRoot}.`);
  }
  return candidates[0];
}

const reportDirectory = resolveReportDirectory(process.argv[2]);
const child = spawn(process.execPath, [
  playwrightCli,
  'show-report',
  reportDirectory,
], {
  cwd: packageDirectory,
  stdio: 'inherit',
});

const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (code, signal) => {
    if (signal) {
      reject(new Error(`Report dihentikan oleh signal ${signal}.`));
      return;
    }
    resolve(code ?? 1);
  });
});
process.exitCode = exitCode;

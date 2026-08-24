import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  fileURLToPath,
  pathToFileURL,
} from 'node:url';
import dotenv from 'dotenv';
import { readPackageManifest } from '../spse/utils/package-manifest.js';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const repoRoot = path.resolve(packageDir, '../..');
const playwrightCli = path.resolve(
  repoRoot,
  'node_modules/@playwright/test/cli.js'
);
const aliasLoader = path.resolve(repoRoot, 'alias-loader.mjs');

dotenv.config({
  path: path.resolve(repoRoot, '.env'),
  quiet: true,
});

const flows = [
  {
    number: 1,
    name: 'PPK membuat paket',
    expectedStatus: 'SENT_TO_UKPBJ',
    specs: [
      'spse/tests/e2e/create-health-construction-non-tender.spec.js',
    ],
  },
  {
    number: 2,
    name: 'Kepala UKPBJ mengirim paket ke Pokja',
    expectedStatus: 'SENT_TO_POKJA',
    specs: [
      'spse/tests/e2e/approve-health-construction-ukpbj.spec.js',
    ],
  },
  {
    number: 3,
    name: 'Tiga anggota Pokja menyetujui paket',
    expectedStatus: 'POKJA_APPROVED',
    specs: [
      'spse/tests/e2e/approve-non-tender-pokja.spec.js',
    ],
  },
  {
    number: 4,
    name: 'Penyedia menerima paket',
    expectedStatus: 'ACCEPTED_BY_PROVIDER',
    specs: [
      'spse/tests/e2e/accept-non-tender-provider.spec.js',
    ],
  },
  {
    number: 5,
    name: 'Pemberian Penjelasan',
    expectedStatus: 'FLOW5_EXPLANATION_COMPLETED',
    specs: [
      'spse/tests/e2e/flow5-explanation.spec.js',
    ],
  },
  {
    number: 6,
    name: 'Upload Dokumen Penawaran',
    expectedStatus: 'FLOW6_SUBMISSION_COMPLETED',
    specs: [
      'spse/tests/e2e/flow6-qualification.spec.js',
      'spse/tests/e2e/flow6-offer.spec.js',
    ],
  },
];

function printHelp() {
  process.stdout.write(`
Menjalankan Flow 1-6 SPSE secara berurutan dan deterministik.

Usage:
  npm run test:spse:flow1-6 -- [options]  # dari root repository
  npm run test:flow1-6 -- [options]       # dari workspace web-automation

Options:
  --from <1-6>       Mulai dari flow tertentu (default: 1)
  --to <1-6>         Berhenti pada flow tertentu (default: 6)
  --manifest <path>  Path manifest bersama Flow 1-6
  --headed           Tampilkan browser
  --dry-run          Tampilkan urutan tanpa menjalankan test
  --help, -h         Tampilkan bantuan

Contoh:
  npm run test:spse:flow1-6 -- --headed
  npm run test:spse:flow1-6 -- --from 3 --to 6 --manifest /tmp/paket.json

Catatan:
  - Runner selalu memakai --project=spse --workers=1 --retries=0.
  - Flow 1 memakai skenario Dinas Kesehatan/Pengadaan Barang canonical.
  - Jika mulai dari Flow 2-6, manifest yang sudah ada wajib diberikan melalui
    --manifest atau SPSE_PACKAGE_MANIFEST.
  - Jika mulai dari Flow 1, path manifest output harus belum ada.
`);
}

function readOptionValue(args, index, optionName) {
  const argument = args[index];
  const inlinePrefix = `${optionName}=`;
  if (argument.startsWith(inlinePrefix)) {
    return {
      value: argument.slice(inlinePrefix.length),
      consumed: 0,
    };
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} membutuhkan nilai.`);
  }
  return {
    value,
    consumed: 1,
  };
}

function parseFlowNumber(value, optionName) {
  const flowNumber = Number(value);
  if (!Number.isInteger(flowNumber) || flowNumber < 1 || flowNumber > 6) {
    throw new Error(`${optionName} harus berupa angka 1 sampai 6.`);
  }
  return flowNumber;
}

function parseArguments(args) {
  const options = {
    from: 1,
    to: 6,
    headed: false,
    dryRun: false,
    help: false,
    manifest: null,
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--headed') {
      options.headed = true;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--from' || argument.startsWith('--from=')) {
      const parsed = readOptionValue(args, index, '--from');
      options.from = parseFlowNumber(parsed.value, '--from');
      index += parsed.consumed;
    } else if (argument === '--to' || argument.startsWith('--to=')) {
      const parsed = readOptionValue(args, index, '--to');
      options.to = parseFlowNumber(parsed.value, '--to');
      index += parsed.consumed;
    } else if (argument === '--manifest'
      || argument.startsWith('--manifest=')) {
      const parsed = readOptionValue(args, index, '--manifest');
      options.manifest = parsed.value;
      index += parsed.consumed;
    } else {
      throw new Error(`Opsi tidak dikenal: ${argument}`);
    }
  }

  if (options.from > options.to) {
    throw new Error('--from tidak boleh lebih besar dari --to.');
  }
  return options;
}

function createDefaultManifestPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(
    packageDir,
    `spse/runtime/packages/flow1-6-${timestamp}-${process.pid}.json`
  );
}

function resolveManifestPath(options) {
  if (options.manifest) {
    return path.resolve(options.manifest);
  }
  if (options.from > 1) {
    if (!process.env.SPSE_PACKAGE_MANIFEST) {
      throw new Error(
        'SPSE_PACKAGE_MANIFEST atau --manifest wajib saat memulai dari Flow 2-6.'
      );
    }
    return path.resolve(process.env.SPSE_PACKAGE_MANIFEST);
  }
  if (process.env.SPSE_OUTPUT_PACKAGE_MANIFEST) {
    return path.resolve(process.env.SPSE_OUTPUT_PACKAGE_MANIFEST);
  }
  return createDefaultManifestPath();
}

function readManifest(manifestPath, options = {}) {
  try {
    return readPackageManifest(manifestPath, options);
  } catch (error) {
    throw new Error(
      `Manifest tidak dapat dibaca: ${manifestPath}. ${error.message}`
    );
  }
}

function validateManifestStatus(flow, manifestPath) {
  return readManifest(manifestPath, { allowedStatuses: [flow.expectedStatus], });
}

function formatCommand(spec, options) {
  const args = [
    'playwright',
    'test',
    spec,
    '--project=spse',
    '--workers=1',
    '--retries=0',
  ];
  if (options.headed) args.push('--headed');
  return `npx ${args.join(' ')}`;
}

function runSpec(spec, options, manifestPath, flowNumber) {
  const args = [
    playwrightCli,
    'test',
    spec,
    '--project=spse',
    '--workers=1',
    '--retries=0',
  ];
  if (options.headed) args.push('--headed');

  const loaderOption = `--loader=${pathToFileURL(aliasLoader).href}`;
  const existingNodeOptions = process.env.NODE_OPTIONS || '';
  const nodeOptions = existingNodeOptions.includes('alias-loader.mjs')
    ? existingNodeOptions
    : `${existingNodeOptions} ${loaderOption} --no-warnings`.trim();
  const guideFlow = (
    process.env.SPSE_GUIDE_FLOW_PATTERN || 'flow-{flow}'
  ).replace('{flow}', String(flowNumber));

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: packageDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions,
        SPSE_PACKAGE_MANIFEST: manifestPath,
        SPSE_OUTPUT_PACKAGE_MANIFEST: manifestPath,
        SPSE_GUIDE_FLOW: guideFlow,
      },
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Test dihentikan oleh signal ${signal}.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Test gagal dengan exit code ${code}.`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const manifestPath = resolveManifestPath(options);
  const selectedFlows = flows.filter((flow) => (
    flow.number >= options.from && flow.number <= options.to
  ));

  if (options.from > 1 && !options.dryRun) {
    readManifest(manifestPath);
  }
  if (options.from === 1
    && fs.existsSync(manifestPath)
    && !options.dryRun) {
    throw new Error(
      `Runner tidak akan menimpa manifest yang sudah ada: ${manifestPath}. `
      + 'Gunakan path baru atau lanjutkan dengan --from.'
    );
  }

  process.stdout.write(`Manifest: ${manifestPath}\n`);
  process.stdout.write(
    `Flow: ${options.from} sampai ${options.to}\n`
  );

  for (const flow of selectedFlows) {
    process.stdout.write(`\n[Flow ${flow.number}] ${flow.name}\n`);
    for (const spec of flow.specs) {
      process.stdout.write(`  ${formatCommand(spec, options)}\n`);
      if (!options.dryRun) {
        await runSpec(spec, options, manifestPath, flow.number);
      }
    }
    if (!options.dryRun) {
      const manifest = validateManifestStatus(flow, manifestPath);
      process.stdout.write(
        `  Status tervalidasi: ${manifest.status}\n`
      );
    }
  }

  if (options.dryRun) {
    process.stdout.write('\nDry run selesai; tidak ada test yang dijalankan.\n');
  } else {
    process.stdout.write(
      `\nFlow ${options.from}-${options.to} selesai. Manifest: ${manifestPath}\n`
    );
  }
}

main().catch((error) => {
  process.stderr.write(`\nRunner Flow 1-6 gagal: ${error.message}\n`);
  process.exitCode = 1;
});

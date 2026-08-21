import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const guideDir = path.resolve(
  repoRoot,
  'packages/web-automation/docs/visual-guide-flow1-6-20260821'
);
const manifestPath = path.join(guideDir, 'package-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const flowMeta = {
  1: {
    title: 'Flow 1 — PPK membuat paket Non-Tender',
    role: 'PPK / Dinas Kesehatan',
    purpose: 'Membuat paket Pengadaan Barang dengan metode Penunjukan Langsung dan meneruskannya ke Kepala UKPBJ.',
  },
  2: {
    title: 'Flow 2 — Kepala UKPBJ meneruskan paket ke Pokja',
    role: 'Kepala UKPBJ',
    purpose: 'Memverifikasi paket yang dibuat PPK dan mengirimkannya kepada Pokja.',
  },
  3: {
    title: 'Flow 3 — Tiga anggota Pokja menyetujui paket',
    role: 'Pokja 1, Pokja 2, Pokja 3',
    purpose: 'Mengisi jadwal, kualifikasi/KBKI bila diperlukan, dokumen persiapan, penyedia, lalu menyetujui Pakta Integritas secara berurutan.',
  },
  4: {
    title: 'Flow 4 — Penyedia menyetujui dan mengikuti paket',
    role: 'Penyedia / Angsae Baru',
    purpose: 'Membaca Pakta Integritas, klik Setuju & Ikut Paket, lalu memastikan paket masuk ke Beranda penyedia.',
  },
  5: {
    title: 'Flow 5 — Tahap 1: Pemberian Penjelasan',
    role: 'Penyedia lalu Pokja',
    purpose: 'Mengaktifkan sesi 25, mengirim lima pertanyaan (dua dengan lampiran), lalu Pokja menjawab semuanya dan mengunduh lampiran.',
  },
  6: {
    title: 'Flow 6 — Tahap 2: Upload Dokumen Penawaran',
    role: 'Penyedia / Angsae Baru',
    purpose: 'Mengirim kualifikasi, Surat Penawaran, enam dokumen teknis, dua lampiran harga, harga + PPN 11%, dan TKDN/PDN.',
  },
};

const runCommand = (spec) => [
  'SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json"',
  'SPSE_GUIDE_CAPTURE=true',
  'SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821"',
  'ENV=SIT',
  spec,
].join(` ${String.fromCharCode(92)}\n`);

const readSteps = (flow) => {
  const jsonlPath = path.join(guideDir, `flow${flow}.jsonl`);
  return fs.readFileSync(jsonlPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const imageFor = (relativeImage) => `./${relativeImage}`;

let markdown = '# Panduan Visual Menjalankan Flow 1–6 SPSE\n\n';
markdown += 'Dokumen ini dibuat dari satu eksekusi headed berurutan pada staging SPSE 2. Setiap screenshot menampilkan titik tindakan yang ditandai oleh capture guide. Arahkan perhatian ke marker/lingkaran oranye pada gambar, kemudian ikuti instruksi **Klik**, **Isi**, **Pilih**, **Unggah**, atau **Download**.\n\n';
markdown += '## Paket yang digunakan\n\n';
markdown += `- **Package ID:** \`${manifest.packageId}\`\n`;
markdown += `- **Nama:** ${manifest.packageName}\n`;
markdown += `- **URL:** [Buka paket di SPSE 2](${manifest.packageUrl})\n`;
markdown += `- **Satuan kerja:** ${manifest.satker}\n`;
markdown += `- **Jenis / metode:** ${manifest.jenisPengadaan} / ${manifest.metodePemilihan}\n`;
markdown += `- **Pagu:** Rp${Number(manifest.rupPagu).toLocaleString('id-ID')}\n`;
markdown += `- **HPS:** Rp${Number(manifest.hps).toLocaleString('id-ID')}\n`;
markdown += `- **Status akhir:** \`${manifest.status}\`\n\n`;

markdown += '## Prasyarat dan konfigurasi\n\n';
markdown += '1. Pastikan VPN/staging dapat diakses dan gunakan base URL **https://pengadaan-stg-2.eproc.dev/spse/**.\n';
markdown += '2. Salin konfigurasi akun ke `.env` sesuai role (PPK, Kepala UKPBJ, Pokja 1–3, dan Penyedia). Jangan menaruh password di dokumentasi atau commit.\n';
markdown += '3. Jalankan dari root repository: `npm install`, lalu gunakan `ENV=SIT`.\n';
markdown += '4. Untuk jadwal pelatihan, pilih **Sesi #25** pada panel sesi di bagian bawah halaman. Flow 5 memakai `23-08-2026 10:00`; Flow 6 memakai `24-08-2026 10:00`. Tanggal undangan memakai tanggal real dan tidak divalidasi terhadap sesi.\n';
markdown += '5. Fixture utama: `packages/web-automation/spse/fixtures/data/flow5.data.js`, `packages/web-automation/spse/fixtures/data/flow6.data.js`, dan `packages/web-automation/spse/fixtures/data/pokja-approval.data.js`. Pilih subset data di fixture sebelum menjalankan ulang.\n\n';

markdown += '## Jalankan berurutan\n\n';
markdown += 'Perintah berikut dipakai satu per satu. Flow berikutnya membaca manifest dari Flow 1, jadi jangan mengganti atau menghapus file manifest di tengah rangkaian.\n\n';
markdown += '```bash\n';
markdown += `${runCommand('npm run test:spse:headed -- spse/tests/e2e/create-health-construction-non-tender.spec.js --project=spse --workers=1')}\n\n`;
markdown += `${runCommand('npm run test:spse:headed -- spse/tests/e2e/approve-health-construction-ukpbj.spec.js --project=spse --workers=1')}\n\n`;
markdown += `${runCommand('SPSE_POKJA_NAME="Cirebon Pokja Trial" npm run test:spse:headed -- spse/tests/e2e/approve-non-tender-pokja.spec.js --project=spse --workers=1')}\n\n`;
markdown += `${runCommand('SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" npm run test:spse:headed -- spse/tests/e2e/accept-non-tender-provider.spec.js --project=spse --workers=1')}\n\n`;
markdown += `${runCommand('SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" SPSE_POKJA_NAME="Cirebon Pokja Trial" npm run test:spse:headed -- spse/tests/e2e/flow5-explanation.spec.js --project=spse --workers=1')}\n\n`;
markdown += `${runCommand('SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" npm run test:spse:headed -- spse/tests/e2e/flow6-qualification.spec.js --project=spse --workers=1')}\n\n`;
markdown += `${runCommand('SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" npm run test:spse:headed -- spse/tests/e2e/flow6-offer.spec.js --project=spse --workers=1')}\n`;
markdown += '```\n\n';

markdown += '## Ringkasan validasi hasil\n\n';
markdown += '| Flow | Status yang diharapkan | Hasil eksekusi |\n|---|---|---|\n';
markdown += `| 1 | SENT_TO_UKPBJ | ${manifest.approvedBy ? 'berhasil' : 'berhasil membuat manifest'} |\n`;
markdown += '| 2 | SENT_TO_POKJA | berhasil |\n';
markdown += `| 3 | POKJA_APPROVED | ${manifest.pokjaApprovals?.length === 3 ? 'berhasil (3 anggota)' : 'perlu verifikasi'} |\n`;
markdown += `| 4 | ACCEPTED_BY_PROVIDER | ${manifest.acceptedByProvider ? 'berhasil + validasi Beranda' : 'perlu verifikasi'} |\n`;
markdown += `| 5 | FLOW5_EXPLANATION_COMPLETED | ${manifest.flow5ProviderQuestionCount === 5 && manifest.flow5PokjaAnswerCount === 5 ? 'berhasil (5 pertanyaan + 5 jawaban)' : 'perlu verifikasi'} |\n`;
markdown += `| 6 | FLOW6_SUBMISSION_COMPLETED | ${manifest.flow6CompletedAt ? 'berhasil' : 'perlu verifikasi'} |\n\n`;

for (const [flow, meta] of Object.entries(flowMeta)) {
  const steps = readSteps(flow);
  markdown += `## ${meta.title}\n\n`;
  markdown += `**Peran:** ${meta.role}  \n**Tujuan:** ${meta.purpose}\n\n`;
  markdown += '### Arahan singkat\n\n';
  const uniqueInstructions = [...new Map(steps.map((step) => [step.instruction, step])).values()];
  for (const step of uniqueInstructions) {
    markdown += `- **${step.action || 'Validasi'}:** ${step.instruction}. ${step.expected}\n`;
  }
  markdown += '\n### Screenshot langkah\n\n';
  for (const step of steps) {
    markdown += `#### Langkah ${step.step} — ${step.instruction}\n\n`;
    markdown += `**${step.action || 'Validasi'}:** ${step.expected}\n\n`;
    markdown += `![Flow ${flow} langkah ${step.step}: ${step.instruction}](${imageFor(step.image)})\n\n`;
  }
}

markdown += '## Catatan hasil aktual\n\n';
markdown += '- Flow 3 sempat menemukan katalog KBKI kosong pada respons pertama. Implementasi sekarang melakukan retry pencarian huruf `b`, menunggu data async, membuka ulang dropdown, dan mengulang konteks Pokja; eksekusi ini berhasil menyelesaikan ketiga persetujuan.\n';
markdown += '- Pada Flow 6, nilai sebelum PPN Rp9.000.000.000, PPN 11% Rp990.000.000, total Rp9.990.000.000 (di bawah HPS Rp10.000.000.000).\n';
markdown += '- Dua lampiran pertanyaan Flow 5, enam upload teknis Flow 6, dan dua lampiran harga tervalidasi dengan nama file, ukuran, hash SHA-256, dan/atau download.\n';
markdown += '- UI staging saat ini tidak mengekspos link TTE/Bukti Penyampaian Penawaran; validasi akhir mencatat status tersebut sebagai `NOT_EXPOSED_BY_CURRENT_UI`.\n';
markdown += '- Server menerima payload Total PDN, tetapi setelah reload input persentase PDN kembali `0`; ini dicatat di manifest sebagai `tkdnPersisted: false` dan bukan kegagalan pengiriman harga.\n';

fs.writeFileSync(path.join(guideDir, 'README.md'), markdown);
process.stdout.write(`Wrote ${path.join(guideDir, 'README.md')}\n`);

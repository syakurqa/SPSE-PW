# SPSE Web Automation

Seluruh test Playwright di package ini berada di `spse/`.

```text
spse/
├── config/     # validasi environment dan identitas aktor
├── fixtures/   # fixture Playwright dan factory data skenario
├── pom/        # selector serta operasi UI per halaman
├── tests/      # end-to-end dan unit test
└── utils/      # state machine manifest dan screenshot panduan
```

Selector UI disimpan di kelas `pom/`; spec hanya mengorkestrasi skenario dan
assertion. Data bisnis dibentuk oleh factory `create*Data`, sedangkan akun dan
manifest masuk melalui `workflow.fixture.js`. Jangan menambahkan credential,
tanggal, atau selector CSS langsung ke spec.

## Struktur yang perlu diubah QA

| Kebutuhan | Lokasi |
| --- | --- |
| Akun, sesi, tanggal, dan nilai sederhana | `.env` di root repository |
| Skenario paket Flow 1 | `spse/fixtures/data/non-tender.data.js` |
| Jadwal/persyaratan Flow 3 | `spse/fixtures/data/pokja-approval.data.js` |
| Pertanyaan dan jawaban Flow 5 | `spse/fixtures/data/flow5.data.js` |
| Selection, file, dan nilai penawaran Flow 6 | `spse/fixtures/data/flow6.data.js` |
| Perubahan locator/behavior halaman | kelas terkait di `spse/pom/` |

Manifest merupakan state machine berversi. Setiap perubahan memakai revision,
lock file, penulisan atomik, dan aturan transisi status. Karena itu Flow 2–6
dapat dilanjutkan dari checkpoint yang sudah tervalidasi tanpa mengulang aksi
yang sudah berhasil. Jangan mengedit `status`, `revision`, atau `history`
manifest secara manual.

Konvensi perubahan:

- Simpan locator dan operasi halaman di POM; spec hanya menyusun alur dan assertion.
- Tambahkan data skenario melalui factory/fixture, bukan object global yang dimutasi.
- Utamakan role, label, dan state server/UI yang stabil; hindari selector persona ID atau `.first()` sebagai fallback lintas akun.
- Tunggu state nyata (response, status, row DataTable, atau nilai tersimpan), bukan jeda waktu tetap untuk proses bisnis.
- Buat aksi resume sebagai `ensure*`/rekonsiliasi: cek hasil server dahulu, lakukan aksi hanya bila hasil belum ada, lalu transisikan manifest.
- Field wajib harus gagal cepat dengan pesan yang menyebut data/selector yang hilang; jangan menelan error upload atau penyimpanan.

## Runner Flow 1–6

Runner resmi menjalankan satu paket secara berurutan dari PPK sampai Penyedia.
Setiap spec dijalankan dengan `--project=spse --workers=1 --retries=0`,
sehingga manifest dan sesi yang sama tidak diproses paralel.
Flow 1 menggunakan skenario canonical Dinas Kesehatan, Pengadaan Barang,
Penunjukan Langsung, pagu di atas Rp10 miliar, dan HPS Rp10 miliar.

Konfigurasikan `.env` di root repository dan akun PPK utama di
`packages/common-module/config/env.sit.json` atau `env.uat.json`. Minimal
sediakan akun PPK, Kepala UKPBJ, Pokja 1–3, serta Penyedia. Pilih Pokja dengan
nama exact atau index 1-based (default `1`). Detail
field fixture berada di
[README root](../../README.md#konfigurasi-data-test-flow-16).

Jalankan seluruh flow dari root repository:

```bash
npm run test:spse:flow1-6 -- --headed
```

Runner membuat path manifest baru jika Flow 1 dimulai tanpa
`SPSE_OUTPUT_PACKAGE_MANIFEST`, lalu meneruskan path yang sama ke Flow 2–6.
Untuk melanjutkan paket yang sudah ada:

```bash
npm run test:spse:flow1-6 -- \
  --from 3 --to 6 \
  --manifest /absolute/path/package-manifest.json \
  --headed
```

Periksa urutan tanpa membuka browser atau mengubah data:

```bash
npm run test:spse:flow1-6 -- --dry-run
npm run test:spse:flow1-6 -- --help
```

Gunakan `npm run lint:spse:check` untuk validasi tanpa mengubah source, dan
`npm run lint:spse:fix` hanya ketika memang ingin menerapkan autofix. Unit test
factory dan manifest dapat dijalankan tanpa akses VPN:

```bash
npm run test:spse:unit
```

Runner sengaja memakai `--retries=0`; pemulihan dilakukan berdasarkan status
manifest dan bukti dari UI, bukan dengan mengulang seluruh flow secara buta.

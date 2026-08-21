# SPSE Playwright Automation

Automation end-to-end proses paket **Non-Tender – Penunjukan Langsung** pada SPSE. Flow 1–6 memakai satu manifest yang sama agar paket selalu dapat dilacak saat berpindah dari PPK ke Kepala UKPBJ, Pokja, dan Penyedia.

> Test membuat dan mengubah data SPSE. Gunakan hanya environment dan akun pengujian yang disetujui.

## Alur dan status

| Flow | Aktor | Proses | Status akhir manifest |
| --- | --- | --- | --- |
| 1 | PPK | Membuat paket, HPS, dokumen persiapan, dan mengirim ke UKPBJ | `SENT_TO_UKPBJ` |
| 2 | Kepala UKPBJ | Review, memilih Pokja, upload Nota Dinas, dan mengirim paket | `SENT_TO_POKJA` |
| 3 | 3 anggota Pokja | Melengkapi paket dan menyetujui Pakta Integritas | `POKJA_APPROVED` |
| 4 | Penyedia | Menyetujui Pakta Integritas dan mengikuti paket | `ACCEPTED_BY_PROVIDER` |
| 5 | Penyedia + Pokja | Lima pertanyaan pemberian penjelasan dan lima jawaban | `FLOW5_EXPLANATION_COMPLETED` |
| 6 | Penyedia | Memilih dan mengirim Data Kualifikasi | `FLOW6_QUALIFICATION_SENT` |

Manifest default berada di `packages/web-automation/spse/runtime/packages/<package-id>.json`. Folder runtime diabaikan Git karena berisi state lokal.

## Persiapan

Prasyarat:

- Node.js 20 atau lebih baru.
- VPN dan akses ke environment SPSE.
- Akun test PPK, Kepala UKPBJ, tiga anggota Pokja, dan Penyedia.
- RUP yang sesuai dengan skenario Flow 1.

Instal dependency dan browser:

```bash
npm install
npx playwright install chromium
```

Semua perintah dalam panduan ini dijalankan dari root repository.

## Setup environment

Salin template:

```bash
cp .env.example .env
```

Isi `.env` lokal berikut. Jangan commit credential aktual.

```dotenv
ENV=SIT

# PPK untuk re-login/SSO Flow 1
SPSE_PPK_USERNAME=<email-ppk>
SPSE_PPK_PASSWORD=<password-ppk>

# Flow 1 khusus Pengadaan Langsung -> Pejabat Pengadaan
SPSE_PPK_PP_USERNAME=<email-ppk-khusus>
SPSE_PPK_PP_PASSWORD=<password-ppk-khusus>
SPSE_PPK_PP_RUP_INDEX=1

# Flow 2
SPSE_UKPBJ_USERNAME=<email-kepala-ukpbj>
SPSE_UKPBJ_PASSWORD=<password-kepala-ukpbj>
SPSE_POKJA_NAME=<nama-pokja-exact>
SPSE_POKJA_INDEX=1

# Flow 3 dan jawaban Pokja pada Flow 5
SPSE_POKJA_1_USERNAME=<email-pokja-1>
SPSE_POKJA_1_PASSWORD=<password-pokja-1>
SPSE_POKJA_2_USERNAME=<email-pokja-2>
SPSE_POKJA_2_PASSWORD=<password-pokja-2>
SPSE_POKJA_3_USERNAME=<email-pokja-3>
SPSE_POKJA_3_PASSWORD=<password-pokja-3>

# Flow 4-6
SPSE_PROVIDER_USERNAME=<email-penyedia>
SPSE_PROVIDER_PASSWORD=<password-penyedia>

# Diisi setelah Flow 1; Flow 2-6 memakai path yang sama
SPSE_PACKAGE_MANIFEST=/absolute/path/to/package-manifest.json

# Opsional: lokasi output manifest Flow 1
SPSE_OUTPUT_PACKAGE_MANIFEST=/absolute/path/to/package-manifest.json

# Browser dan screenshot panduan
SPSE_BROWSER_CHANNEL=chrome
SLOW_MO=300
VIEWPORT_WIDTH=1470
VIEWPORT_HEIGHT=900
SPSE_GUIDE_CAPTURE=false
SPSE_GUIDE_FLOW=flow-1
SPSE_GUIDE_DIR=/absolute/path/to/screenshots
```

Base URL dan akun PPK utama dibaca dari file lokal sesuai nilai `ENV`:

- `ENV=SIT` → `packages/common-module/config/env.sit.json`
- `ENV=UAT` → `packages/common-module/config/env.uat.json`

Format file:

```json
{
  "SPSE_PLATFORM": {
    "BASE_URL": "https://pengadaan-stg-2.eproc.dev/spse/",
    "USER": {
      "PPK": {
        "username": "<email-ppk>",
        "password": "<password-ppk>"
      }
    }
  }
}
```

Pastikan login ulang tetap menuju SPSE 2. `.env` dan JSON berisi credential harus tetap lokal.

## Pola menjalankan test

Mode headed direkomendasikan agar proses dapat dipantau:

```bash
npm run test:spse:headed -- <file-spec> --project=spse --workers=1
```

Mode headless:

```bash
npm run test:spse -- <file-spec> --project=spse --workers=1
```

Gunakan `--workers=1` karena Flow 1–6 mengubah paket dan manifest yang sama secara berurutan.

## Flow 1 — PPK membuat paket

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/create-non-tender.spec.js \
  --project=spse --workers=1
```

Tahapan:

1. Login sebagai PPK.
2. Buka **Daftar Paket → Non Tender → Buat Paket**.
3. Pilih Satuan Kerja, Metode Pemilihan, Jenis Pengadaan, dan RUP.
4. Isi nama paket serta rincian HPS/KBKI sesuai fixture.
5. Upload dokumen persiapan.
6. Pilih pejabat tujuan dan kirim paket.
7. Validasi notifikasi penyimpanan dan tulis manifest.

Default dapat diubah dengan `SPSE_METODE_PEMILIHAN` dan `SPSE_JENIS_PENGADAAN`. Skenario Dinas Kesehatan, Pengadaan Barang, Penunjukan Langsung, pagu di atas Rp10 miliar, dan HPS Rp10 miliar:

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/create-health-construction-non-tender.spec.js \
  --project=spse --workers=1
```

Skenario Pengadaan Langsung yang dikirim kepada Pejabat Pengadaan:

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/create-non-tender-pp.spec.js \
  --project=spse --workers=1
```

Setelah berhasil, salin path manifest dari hasil test ke `SPSE_PACKAGE_MANIFEST`. Flow 2 hanya menerima Penunjukan Langsung berstatus `SENT_TO_UKPBJ`.

## Flow 2 — Kepala UKPBJ mengirim ke Pokja

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/approve-non-tender-ukpbj.spec.js \
  --project=spse --workers=1
```

1. Login sebagai Kepala UKPBJ.
2. Buka paket berdasarkan ID dan nama exact dari manifest.
3. Periksa dan tandai dokumen persiapan lengkap.
4. Pilih Pokja dengan `SPSE_POKJA_NAME`; indeks menjadi fallback.
5. Upload Nota Dinas KUPPBJ (`datatest.pdf`).
6. Kirim email ke Pokja dan simpan.
7. Validasi pesan berhasil dan status `SENT_TO_POKJA`.

Flow resumable: data yang sudah tersimpan tidak diproses ulang. Untuk menguji upload Nota Dinas saja:

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/upload-ukpbj-note.spec.js \
  --project=spse --workers=1
```

## Flow 3 — persetujuan tiga anggota Pokja

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/approve-non-tender-pokja.spec.js \
  --project=spse --workers=1
```

1. Setiap Pokja login dalam browser context terpisah.
2. Pokja pertama melengkapi sembilan jadwal, Persyaratan Kualifikasi, Dokumen Penawaran, SDP, undangan, berita acara, dan Penyedia.
3. Untuk **Pengadaan Barang biasa**, persyaratan teknis/KBKI tidak dipilih otomatis. KBKI hanya diisi jika dokumen memang mensyaratkannya.
4. Ketiga anggota menyetujui Pakta Integritas berurutan.
5. Status bergerak `POKJA_1_APPROVED` → `POKJA_2_APPROVED` → `POKJA_APPROVED`.

Jika gagal pada anggota kedua/ketiga, jalankan ulang. Anggota yang sudah tercatat akan dilewati.

## Flow 4 — Penyedia menerima paket

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/accept-non-tender-provider.spec.js \
  --project=spse --workers=1
```

1. Login sebagai Penyedia.
2. Buka **Daftar Paket → Non Tender**.
3. Cari dan buka paket berdasarkan manifest.
4. Baca Pakta Integritas lalu klik **Setuju & Ikut Paket**.
5. Kembali ke Beranda/Non Tender dan validasi paket sudah masuk.
6. Status menjadi `ACCEPTED_BY_PROVIDER`.

## Flow 5 — Pemberian Penjelasan

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/flow5-explanation.spec.js \
  --project=spse --workers=1
```

1. Penyedia login dan mengaktifkan sesi default **25** sesuai jadwal Pemberian Penjelasan.
2. Penyedia membuka paket dari Beranda → Non Tender.
3. Kirim lima pertanyaan; dua menggunakan lampiran.
4. Validasi counter dan download lampiran oleh Penyedia.
5. Pokja login, mengaktifkan sesi 25, dan membuka paket yang sama.
6. Pokja memberi lima jawaban detail.
7. Validasi counter dan download lampiran oleh Pokja.
8. Status menjadi `FLOW5_EXPLANATION_COMPLETED`.

Pertanyaan, jawaban, sesi, dan waktu dapat diubah di `packages/web-automation/spse/fixtures/data/flow5.data.js`.

## Flow 6 — Upload Data Kualifikasi

Inspeksi form tanpa mengirim:

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/flow6-inspect.spec.js \
  --project=spse --workers=1
```

Pilih dan kirim Data Kualifikasi:

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/flow6-qualification.spec.js \
  --project=spse --workers=1
```

1. Penyedia login dan mengaktifkan sesi 25 sesuai jadwal Upload Dokumen Penawaran.
2. Buka paket dari Beranda → Non Tender.
3. Pilih Izin Usaha, Personel, Pengalaman, Pekerjaan Berjalan, dan Peralatan.
4. Upload dokumen persyaratan lain menggunakan data test.
5. Kirim Data Kualifikasi dan validasi penyimpanan.
6. Status menjadi `FLOW6_QUALIFICATION_SENT`.

Konfigurasi ada di `packages/web-automation/spse/fixtures/data/flow6.data.js`. Nilai `'all'` memilih seluruh data; array seperti `[0]` memilih hanya data pertama.

> Batasan saat ini: pengiriman Surat Penawaran, penawaran teknis, harga/PPN, TKDN, dan validasi TTE lengkap masih perlu dilanjutkan setelah struktur form environment stabil.

## Menjalankan Flow 1–6 berurutan

Jalankan Flow 1, isi `SPSE_PACKAGE_MANIFEST`, kemudian jalankan Flow 2–6 satu per satu:

```bash
npm run test:spse:headed -- spse/tests/e2e/create-non-tender.spec.js --project=spse --workers=1
npm run test:spse:headed -- spse/tests/e2e/approve-non-tender-ukpbj.spec.js --project=spse --workers=1
npm run test:spse:headed -- spse/tests/e2e/approve-non-tender-pokja.spec.js --project=spse --workers=1
npm run test:spse:headed -- spse/tests/e2e/accept-non-tender-provider.spec.js --project=spse --workers=1
npm run test:spse:headed -- spse/tests/e2e/flow5-explanation.spec.js --project=spse --workers=1
npm run test:spse:headed -- spse/tests/e2e/flow6-qualification.spec.js --project=spse --workers=1
```

## Screenshot, tools, dan troubleshooting

Aktifkan screenshot step-by-step:

```dotenv
SPSE_GUIDE_CAPTURE=true
SPSE_GUIDE_FLOW=flow-1
SPSE_GUIDE_DIR=/absolute/path/to/output
```

| Perintah | Kegunaan |
| --- | --- |
| `npm run lint:spse` | ESLint source web automation. |
| `npm run test:spse` | Test headless. |
| `npm run test:spse:headed` | Test dengan browser terlihat. |
| `npm run test:spse:ui` | Playwright UI. |
| `npm run report:spse` | Membuka report terbaru. |
| `npm run codegen:spse` | Playwright code generator. |
| `npm run capture:spse-upload` | Merekam request upload manual. |

- **Redirect login salah:** cek VPN dan pastikan `BASE_URL` adalah `https://pengadaan-stg-2.eproc.dev/spse/`.
- **Jadwal tidak aktif:** cek sesi default di bawah halaman, pilih sesi flow, dan cocokkan waktunya.
- **Manifest ditolak:** cek status terakhir dan pastikan semua flow memakai path yang sama.
- **Paket Penyedia tidak ditemukan:** buka melalui **Beranda → Non Tender**, bukan Paket Baru.
- **Nota Dinas belum upload:** pastikan PDF tampil dan tombol kirim email enabled sebelum Flow 2 selesai.
- **Pengadaan Barang:** jangan menambah KBKI/persyaratan teknis otomatis kecuali diwajibkan dokumen.

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
| 6 | Penyedia | Mengirim kualifikasi, Surat Penawaran, teknis, harga, PPN, dan TKDN/PDN | `FLOW6_SUBMISSION_COMPLETED` |

Flow 1 standalone menyimpan manifest default sebagai `packages/web-automation/spse/runtime/packages/<package-id>.json`; runner serial memakai nama unik `flow1-6-<timestamp>-<pid>.json` dan meneruskan path tersebut otomatis ke Flow 2–6. Folder runtime diabaikan Git karena berisi state lokal.

Panduan visual lengkap dengan screenshot setiap tindakan tersedia di [`packages/web-automation/docs/visual-guide-flow1-6-20260821/README.md`](packages/web-automation/docs/visual-guide-flow1-6-20260821/README.md). Panduan tersebut memakai satu eksekusi headed terbaru dari Flow 1 sampai Flow 6.

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
# SPSE_PPK_PP_USERNAME=<email-ppk-khusus>
# SPSE_PPK_PP_PASSWORD=<password-ppk-khusus>
# SPSE_PPK_PP_RUP_INDEX=1

# Flow 2
SPSE_UKPBJ_USERNAME=<email-kepala-ukpbj>
SPSE_UKPBJ_PASSWORD=<password-kepala-ukpbj>
# Nama exact opsional; jika kosong digunakan index 1-based
# SPSE_POKJA_NAME=<nama-pokja-exact>
SPSE_POKJA_INDEX=1

# Flow 3 dan jawaban Pokja pada Flow 5
SPSE_POKJA_1_USERNAME=<email-pokja-1>
SPSE_POKJA_1_PASSWORD=<password-pokja-1>
# SPSE_POKJA_1_DISPLAY_NAME=<nama-pokja-1-di-ui>
SPSE_POKJA_2_USERNAME=<email-pokja-2>
SPSE_POKJA_2_PASSWORD=<password-pokja-2>
SPSE_POKJA_3_USERNAME=<email-pokja-3>
SPSE_POKJA_3_PASSWORD=<password-pokja-3>

# Flow 4-6
SPSE_PROVIDER_USERNAME=<email-penyedia>
SPSE_PROVIDER_PASSWORD=<password-penyedia>
# SPSE_PROVIDER_DISPLAY_NAME=<nama-penyedia-di-ui>

# Hanya untuk spec manual/resume; runner serial mengisi path otomatis
# SPSE_PACKAGE_MANIFEST=/absolute/path/to/package-manifest.json

# Opsional: lokasi output manifest Flow 1
# SPSE_OUTPUT_PACKAGE_MANIFEST=/absolute/path/to/package-manifest.json

# Browser dan screenshot panduan
# Kosong memakai Chromium yang diinstal Playwright
SPSE_BROWSER_CHANNEL=
SLOW_MO=300
VIEWPORT_WIDTH=1470
VIEWPORT_HEIGHT=900
SPSE_GUIDE_CAPTURE=false
SPSE_GUIDE_FLOW_PATTERN=flow-{flow}
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

## Konfigurasi data test Flow 1–6

Credential dan path manifest diatur melalui `.env`. Default serta konten bisnis kompleks berada di `packages/web-automation/spse/fixtures/data`; nilai sederhana Flow 5–6 seperti sesi, waktu, selection, file, dan harga juga dapat dioverride dari `.env`. Jangan menulis email atau password langsung di fixture.

### Flow 1 — data paket PPK

Fixture utama: `packages/web-automation/spse/fixtures/data/non-tender.data.js`.

Gunakan factory umum untuk membuat skenario tanpa memutasi object bersama:

```js
const data = createNonTenderTestData({
  satkerQuery: 'DINAS KESEHATAN',
  metodeLabel: 'Penunjukan Langsung',
  jenisPengadaanLabel: 'Pengadaan Barang',
  rupName: null,
  rupIndex: 1,
  minimumPagu: 10_000_000_000,
});
```

Arti field:

| Field | Kegunaan |
| --- | --- |
| `metodeLabel` | `Penunjukan Langsung` atau `Pengadaan Langsung`. |
| `jenisPengadaanLabel` | Contoh: `Pengadaan Barang`, `Pekerjaan Konstruksi`, atau `Jasa Lainnya`. |
| `satkerQuery` | Teks pencarian Satuan Kerja. Gunakan nama yang muncul di UI. |
| `rupName` | Nama RUP exact. Isi `null` bila pemilihan dilakukan berdasarkan indeks/filter. |
| `rupIndex` | Urutan RUP, dimulai dari `1`. Dipakai jika `rupName` tidak ditentukan. |
| `tahun` | Input tahun RUP yang akan dipilih; hasilnya tersedia sebagai `selection.tahun`. |
| `kbkiItems` | Input array HPS/KBKI; hasilnya tersedia sebagai `package.kbkiItems`. |
| `requiresKbki` | Boolean yang menentukan apakah Flow 3 wajib menambahkan KBKI kualifikasi. Default Pengadaan Barang biasa adalah `false`; skenario canonical mengaturnya `true`. |
| `preparationDocument` | Path input dokumen persiapan; hasilnya tersedia sebagai `documents.preparation`. |
| `notaDinasDocument` | Path input Nota Dinas PPK; hasilnya tersedia sebagai `documents.notaDinasPpk`. |

Rincian HPS/KBKI dikonfigurasi melalui input top-level `kbkiItems`:

```js
kbkiItems: [{
  jenisBarang: 'pipa',
  satuan: 'pcs',
  harga: 10_000_000,
  keterangan: 'Data test HPS',
  query: 'pipa',
  selectText: 'Pipa/ slang kain',
}]
```

- `harga` adalah `number` dalam Rupiah; gunakan pemisah `_` di source agar mudah dibaca.
- Total HPS tidak boleh melebihi pagu RUP.
- Untuk Pengadaan Barang biasa, isi KBKI hanya jika memang diwajibkan skenario.
- Konfigurasikan dokumen melalui input `preparationDocument` dan `notaDinasDocument`; hasil factory tersedia sebagai `documents.preparation` dan `documents.notaDinasPpk`.

Override sederhana untuk **spec Flow 1 generik** tanpa mengubah fixture (runner canonical tidak membaca kedua variable ini):

```dotenv
SPSE_METODE_PEMILIHAN=Penunjukan Langsung
SPSE_JENIS_PENGADAAN=Pengadaan Barang
```

Skenario canonical Dinas Kesehatan dan HPS Rp10 miliar dibuat oleh `createHealthGoodsDirectAppointmentData` dan diekspos sebagai fixture `healthGoodsDirectAppointmentData` pada `packages/web-automation/spse/fixtures/base.fixture.js`. Alias lama `nonTenderHealthConstructionData` hanya dipertahankan sementara untuk kompatibilitas. Skenario Pejabat Pengadaan berada pada `nonTenderPPData` di file yang sama.

### Flow 2 — data Kepala UKPBJ

Fixture: `packages/web-automation/spse/fixtures/data/ukpbj-approval.data.js`.

Data paket tidak diisi ulang. Flow 2 wajib memakai manifest Flow 1:

```dotenv
SPSE_PACKAGE_MANIFEST=/absolute/path/to/manifest-flow-1.json
SPSE_POKJA_NAME=Cirebon Pokja Trial
SPSE_POKJA_INDEX=1
```

- Gunakan `SPSE_POKJA_NAME` untuk memilih nama exact.
- `SPSE_POKJA_INDEX` hanya fallback dan dimulai dari `1`.
- File Nota Dinas ditentukan oleh `documents.assignment`. Default-nya `packages/common-module/fixtures/documents/datatest.pdf`.
- Jika ingin memakai file lain, ubah `documentPath` di fixture ke file test yang valid dan pastikan formatnya PDF.
- Jangan mengubah `packageId`, `packageName`, atau status langsung saat Flow 2 sedang berjalan.

### Flow 3 — jadwal, kualifikasi, dan Pokja

Fixture: `packages/web-automation/spse/fixtures/data/pokja-approval.data.js`.

Bagian yang dapat dikonfigurasi:

```js
schedule: {
  firstDayOffset: 1,
  stageCount: 9,
  startHour: 8,
  endHour: 16,
},
businessQualification: 'Kecil',
qualification: {
  source: 'KBLI',
  query: 'makan',
  classification: /1075\s*-\s*Industri Makanan/i,
  administrativeIndexes: [4],
  technicalIndexes: [],
  kbkiQuery: 'b',
},
offerValidityDays: 90,
```

| Field | Kegunaan |
| --- | --- |
| `firstDayOffset` | Hari pertama jadwal dihitung dari tanggal eksekusi. `1` berarti H+1. |
| `stageCount` | Jumlah tahap jadwal; Penunjukan Langsung memakai sembilan tahap. |
| `startHour` / `endHour` | Jam mulai dan selesai setiap tahap. |
| `businessQualification` | Kualifikasi usaha yang dipilih. |
| `administrativeIndexes` | Indeks checkbox persyaratan administrasi. |
| `technicalIndexes` | Indeks checkbox teknis. Gunakan `[]` untuk Pengadaan Barang biasa. |
| `kbkiQuery` | Query KBKI. Skenario canonical memakai `b`; gunakan `null` hanya jika manifest tidak mewajibkan KBKI. |
| `offerValidityDays` | Masa berlaku penawaran dalam hari. |

Konfigurasi tambahan:

- `offerDocument`: indeks persyaratan dokumen penawaran.
- `sdpNumber`: nomor SDP.
- `invitation`: tempat, peralatan, dan peserta undangan.
- `provider.query`: kata pencarian Penyedia; `provider.index` dimulai dari `0`.
- `documents.sdp`, `documents.invitation`, dan `documents.minutes`: file PDF data test.

Untuk Pengadaan Barang, fixture memakai persyaratan administrasi `[4]` dan teknis `[]`. Nilai `kbkiQuery` mengikuti `manifest.requiresKbki`: paket canonical Flow 1 bernilai `true`, mencari huruf `b`, klik **Tambah** pada hasil KBKI, lalu menyimpan; paket barang biasa yang tidak mensyaratkan KBKI menggunakan `null`.

### Flow 4 — data Penyedia

Flow 4 tidak memiliki fixture bisnis terpisah. Datanya berasal dari manifest Flow 3 dan `.env`:

```dotenv
SPSE_PACKAGE_MANIFEST=/absolute/path/to/manifest-yang-sama.json
SPSE_PROVIDER_USERNAME=<email-penyedia-yang-dipilih-flow-3>
SPSE_PROVIDER_PASSWORD=<password-penyedia>
```

`SPSE_PROVIDER_USERNAME` harus merupakan Penyedia yang dipilih pada `provider.query`/`provider.index` di Flow 3. Jika berbeda, paket tidak akan muncul pada **Beranda → Non Tender** akun tersebut.

### Flow 5 — pertanyaan dan jawaban

Factory: `createFlow5Data` di `packages/web-automation/spse/fixtures/data/flow5.data.js`.

```js
const scenario = createFlow5Data({
  sessionNumber: 25,
  explanationTime: '23-08-2026 10:00',
  questions: [
    {
      document: 'Dokumen Pemilihan',
      chapter: 'Ruang Lingkup Pekerjaan',
      text: 'Isi pertanyaan yang relevan dengan paket.',
      attachment: attachmentPath,
    },
  ],
  answers: [
    'Jawaban Pokja untuk pertanyaan pada indeks yang sama.',
  ],
});
```

- `sessionNumber` harus sama dengan sesi default yang dipilih di bagian bawah web.
- `explanationTime` memakai format `DD-MM-YYYY HH:mm` dan harus berada pada jadwal Pemberian Penjelasan paket.
- Setiap pertanyaan membutuhkan `document`, `chapter`, dan `text`.
- `attachment` opsional; hapus field tersebut untuk pertanyaan tanpa lampiran.
- Jumlah `answers` harus sama dengan jumlah `questions`; jawaban indeks `0` menjawab pertanyaan indeks `0`.
- Gunakan teks yang relevan dengan jenis paket. Jangan memakai jawaban konstruksi untuk paket Pengadaan Barang.

Override yang tersedia tanpa mengubah source:

| Environment | Contoh | Kegunaan |
| --- | --- | --- |
| `SPSE_FLOW5_SESSION_NUMBER` | `25` | Sesi default latihan. |
| `SPSE_FLOW5_EXPLANATION_TIME` | `23-08-2026 10:00` | Waktu tahap Pemberian Penjelasan. |
| `SPSE_FLOW5_QUESTION_COUNT` | `5` | Banyak pertanyaan/jawaban yang digunakan dari fixture. |
| `SPSE_FLOW5_ATTACHMENT_COUNT` | `2` | Banyak pertanyaan awal yang memakai lampiran. |
| `SPSE_FLOW5_ATTACHMENT_FILE` | `/data/lampiran.pdf` | File PDF/ZIP pengganti untuk lampiran. |

### Flow 6 — pilihan Data Kualifikasi

Factory: `createFlow6Data` di `packages/web-automation/spse/fixtures/data/flow6.data.js`.

```js
const scenario = createFlow6Data({
  sessionNumber: 25,
  offerTime: '24-08-2026 10:00',
  qualification: {
    businessPermits: 'all',
    personnel: 'all',
    experience: 'all',
    ongoingWork: 'all',
    equipment: 'all',
    otherRequirementFile: testDocument,
  },
  offer: {
    technicalFile: testDocument,
    priceRequirementFiles: [testDocument, null],
    priceBeforeVat: 9_000_000_000,
    vatPercent: 11,
    tkdnPercent: 20,
  },
});
```

Cara memilih data pada setiap kelompok:

```js
businessPermits: 'all', // pilih seluruh baris
personnel: [0],         // hanya baris pertama
experience: [0, 2],    // baris pertama dan ketiga
ongoingWork: [],        // tidak memilih baris
```

- Indeks dimulai dari `0` dan mengikuti urutan data yang tampil pada akun Penyedia.
- `sessionNumber` harus sama dengan sesi default aktif.
- `offerTime` harus berada pada jadwal Upload Dokumen Penawaran.
- `otherRequirementFile` dan `technicalFile` harus menunjuk file test yang tersedia.
- Jalankan `flow6-inspect.spec.js` dahulu ketika struktur form atau data SIKaP/VMS berubah.

`technicalFile` dapat berupa satu file untuk semua persyaratan, array sesuai urutan kontrol, atau pemetaan agar file berbeda mudah dipelihara:

```js
technicalFile: {
  defaultFile: testDocument,
  byRequirementId: { 101: technicalZip },
  byRequirementName: { Brosur: brochurePdf },
}
```

Semua field Flow 6 juga dapat dioverride dari `.env` dengan awalan `SPSE_FLOW6_`. Daftar lengkap dan format selection (`all`, `none`, `0,2`, atau `[0,2]`) tersedia di `.env.example`.

### Checklist sebelum eksekusi

1. Pastikan VPN aktif dan `BASE_URL` menuju SPSE 2.
2. Pastikan RUP, Satker, metode, jenis pengadaan, pagu, dan HPS Flow 1 saling sesuai.
3. Pastikan Pokja di Flow 2 sama dengan tiga akun Pokja pada Flow 3.
4. Pastikan Penyedia yang dipilih Flow 3 sama dengan credential Flow 4–6.
5. Gunakan satu `SPSE_PACKAGE_MANIFEST` yang sama untuk Flow 2–6.
6. Perbarui tanggal `explanationTime` dan `offerTime`, lalu cocokkan sesi default dengan jadwal paket.
7. Pastikan seluruh path dokumen menunjuk file yang ada dan berformat sesuai.

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

Default spec generik dapat diubah dengan `SPSE_METODE_PEMILIHAN` dan `SPSE_JENIS_PENGADAAN`. Skenario canonical runner—Dinas Kesehatan, Pengadaan Barang, Penunjukan Langsung, pagu di atas Rp10 miliar, dan HPS Rp10 miliar—menggunakan:

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
  spse/tests/e2e/approve-health-construction-ukpbj.spec.js \
  --project=spse --workers=1
```

Gunakan `approve-non-tender-ukpbj.spec.js` hanya untuk skenario Flow 1 generik; runner canonical memakai spec di atas agar jenis pengadaan, Satker, HPS, upload, dan bukti penerusan ikut divalidasi.

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
2. Buka **Beranda → Non Tender**.
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

## Flow 6 — Upload Dokumen Penawaran (kualifikasi + teknis + harga)

Inspeksi form tanpa mengirim:

```bash
npm run test:spse:flow6:inspect -- --headed
```

Kirim Data Kualifikasi terlebih dahulu:

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
6. Status kualifikasi menjadi terkirim.

Konfigurasi ada di `packages/web-automation/spse/fixtures/data/flow6.data.js`. Nilai `'all'` memilih seluruh data; array seperti `[0]` memilih hanya data pertama.

Kirim bagian penawaran:

```bash
npm run test:spse:headed -- \
  spse/tests/e2e/flow6-offer.spec.js \
  --project=spse --workers=1
```

1. Isi masa berlaku Surat Penawaran (fixture default: 90 hari) dan setujui.
2. Upload setiap persyaratan teknis yang tampil; default memakai `datatest.pdf`, sedangkan fixture dapat memetakan file per ID/nama persyaratan.
3. Isi harga sebelum PPN; sistem menghitung PPN 11% dan menolak nilai di atas HPS.
4. Isi TKDN/PDN 0–100% dan upload lampiran harga bila diperlukan.
5. Simpan, klik **Kirim Penawaran**, lalu validasi status Surat Penawaran, Teknis, dan Harga menjadi **Sudah Kirim**.
6. Validasi download dokumen harga dan catat bukti elektronik bila ditampilkan oleh UI.
7. Status akhir menjadi `FLOW6_SUBMISSION_COMPLETED`.

Pada eksekusi staging terbaru, nilai sebelum PPN Rp9.000.000.000 + PPN 11% Rp990.000.000 = Rp9.990.000.000, masih di bawah HPS Rp10.000.000.000. UI saat ini belum menampilkan link TTE/Bukti Penyampaian; manifest mencatatnya sebagai `NOT_EXPOSED_BY_CURRENT_UI`.

## Menjalankan Flow 1–6 berurutan

Gunakan runner serial agar seluruh flow memakai satu manifest yang sama dan
selalu dijalankan dengan satu worker tanpa retry level test:

```bash
npm run test:spse:flow1-6 -- --headed
```

Runner ini memakai skenario Flow 1 Dinas Kesehatan, Pengadaan Barang,
Penunjukan Langsung, pagu di atas Rp10 miliar, dan HPS Rp10 miliar.

Runner membuat manifest baru ketika dimulai dari Flow 1. Untuk melanjutkan
paket yang sudah ada, berikan manifest dan rentang flow:

```bash
npm run test:spse:flow1-6 -- \
  --from 3 --to 6 \
  --manifest /absolute/path/package-manifest.json \
  --headed
```

Gunakan `--dry-run` untuk melihat urutan tujuh spec tanpa menjalankan browser.
Daftar opsi lengkap tersedia melalui
`npm run test:spse:flow1-6 -- --help`.

## Screenshot, tools, dan troubleshooting

Aktifkan screenshot step-by-step:

```dotenv
SPSE_GUIDE_CAPTURE=true
SPSE_GUIDE_FLOW_PATTERN=flow-{flow}
SPSE_GUIDE_DIR=/absolute/path/to/output
```

Runner memberi nama folder `flow-1` sampai `flow-6` secara otomatis. Setiap langkah menyimpan screenshot viewport beranotasi untuk panduan klik/input dan screenshot `fullImage` bersih untuk pemeriksaan halaman penuh. Jika menjalankan satu spec secara langsung, isi `SPSE_GUIDE_FLOW=flow-3` sesuai kebutuhan.

Opsi lanjutan: `SPSE_DEBUG_FLOW3=true` menyimpan screenshot debug Flow 3 dan `SPSE_USER_AGENT` mengganti user agent browser. Gunakan hanya ketika diperlukan karena opsi tersebut bukan bagian dari runner normal.

Pada CI, simpan username/password dan credential lain sebagai **Secrets**, sedangkan konfigurasi non-sensitif seperti `ENV`, nama/index Pokja, viewport, dan waktu skenario dapat disimpan sebagai **Variables**. Petakan keduanya ke nama environment `SPSE_*` yang sama dengan `.env.example`; jangan commit nilainya ke repository.

| Perintah | Kegunaan |
| --- | --- |
| `npm run lint:spse:check` | ESLint source SPSE tanpa mengubah source. |
| `npm run lint:spse:fix` | Terapkan autofix pada source SPSE yang masuk scope lint. |
| `npm run test:spse -- <spec>` | Menjalankan spec SPSE terpilih secara headless. Untuk alur stateful penuh gunakan runner serial. |
| `npm run test:spse:unit` | Unit test factory data dan state machine manifest. |
| `npm run test:spse:flow1-6 -- --dry-run` | Validasi urutan runner tanpa membuka browser. |
| `npm run test:spse:flow6:inspect -- --headed` | Inspeksi form Flow 6 tanpa mengirim penawaran. |
| `npm run test:spse:headed -- <file-spec>` | Menjalankan spec SPSE terpilih dengan browser terlihat. Jangan jalankan command headed tanpa filter karena akan mengumpulkan banyak flow stateful. |
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

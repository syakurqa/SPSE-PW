# Panduan Menjalankan Flow 1 dan Flow 3 SPSE

Panduan ini menjelaskan hubungan data yang dipilih PPK pada Flow 1 dengan tindakan Pokja pada Flow 3. Tujuannya agar automation tidak menerapkan persyaratan yang sama untuk semua paket, terutama penggunaan KBKI pada paket `Pengadaan Barang` biasa.

## Ringkasan alur

| Flow | Pelaksana | Tujuan | Status akhir |
| --- | --- | --- | --- |
| Flow 1 | PPK | Membuat paket dari RUP, mengisi HPS, mengunggah dokumen, dan mengirim paket | `SENT_TO_UKPBJ` atau `SENT_TO_PROCUREMENT_OFFICER` |
| Flow 2 | Kepala UKPBJ | Memeriksa kelengkapan dan meneruskan paket kepada Pokja | `SENT_TO_POKJA` |
| Flow 3 | Pokja 1, 2, dan 3 | Menyiapkan dokumen pemilihan, jadwal, penyedia, lalu menyetujui pakta integritas | `POKJA_APPROVED` |
| Flow 4 | Penyedia terpilih | Menyetujui Pakta Integritas dan menerima/mengikuti paket | `ACCEPTED_BY_PROVIDER` |

## Aturan penentuan jalur

| Metode pemilihan | Tujuan dari Flow 1 | Flow 2 | Flow 3 Pokja |
| --- | --- | --- | --- |
| Penunjukan Langsung | Kepala UKPBJ | Ya | Ya |
| Pengadaan Langsung | Pejabat Pengadaan | Tidak memakai jalur Kepala UKPBJ | Tidak memakai persetujuan tiga Pokja |

Flow 3 yang tersedia saat ini khusus paket `Non-Tender` dengan metode `Penunjukan Langsung`. Jangan menjalankan skrip Flow 3 Pokja terhadap paket `Pengadaan Langsung`, walaupun jenis pengadaannya sama.

## Flow 1 — membuat paket dengan kondisi tertentu

Parameter utama:

- `SPSE_METODE_PEMILIHAN`: `Penunjukan Langsung` atau `Pengadaan Langsung`.
- `SPSE_JENIS_PENGADAAN`: `Pengadaan Barang`, `Pekerjaan Konstruksi`, `Jasa Konsultansi`, atau `Jasa Lainnya`.
- Data satuan kerja dan RUP berada di fixture skenario. Pastikan RUP yang dipilih memang tersedia untuk satuan kerja, metode, dan jenis pengadaan tersebut.
- Gunakan URL SPSE 2: `https://pengadaan-stg-2.eproc.dev/spse/` melalui konfigurasi environment.

Contoh menjalankan Flow 1 secara headed untuk `Penunjukan Langsung` dan `Pengadaan Barang`:

```bash
SPSE_METODE_PEMILIHAN='Penunjukan Langsung' \
SPSE_JENIS_PENGADAAN='Pengadaan Barang' \
SPSE_OUTPUT_PACKAGE_MANIFEST='packages/web-automation/spse/runtime/packages/paket-baru.json' \
npm test --workspace=@automation/web -- \
  --project=spse \
  spse/tests/e2e/create-non-tender.spec.js \
  --workers=1 --headed
```

Sesudah selesai, periksa manifest:

```bash
jq '{packageName, metodePemilihan, jenisPengadaan, assignedRole, status}' \
  packages/web-automation/spse/runtime/packages/paket-baru.json
```

Hasil yang benar untuk `Penunjukan Langsung` adalah `assignedRole: Kepala UKPBJ` dan `status: SENT_TO_UKPBJ`. Untuk `Pengadaan Langsung`, hasilnya harus `assignedRole: Pejabat Pengadaan` dan `status: SENT_TO_PROCUREMENT_OFFICER`.

### Skenario khusus Dinas Kesehatan, nilai di atas Rp10 miliar

Gunakan test khusus berikut. Skenario memilih `DINAS KESEHATAN`, `Pengadaan Barang`, `Penunjukan Langsung`, RUP dengan pagu lebih dari Rp10 miliar, serta HPS Rp10 miliar.

```bash
SPSE_OUTPUT_PACKAGE_MANIFEST='packages/web-automation/spse/runtime/packages/dinkes-barang-10m.json' \
npm test --workspace=@automation/web -- \
  --project=spse \
  spse/tests/e2e/create-health-construction-non-tender.spec.js \
  --workers=1 --headed
```

Walaupun nama file test masih memuat kata `construction`, data aktual skenario adalah `Pengadaan Barang`.

## Flow 2 — prasyarat sebelum Flow 3

Flow 2 hanya dijalankan untuk manifest Flow 1 berstatus `SENT_TO_UKPBJ`.

```bash
SPSE_PACKAGE_MANIFEST='packages/web-automation/spse/runtime/packages/paket-baru.json' \
npm test --workspace=@automation/web -- \
  --project=spse \
  spse/tests/e2e/approve-non-tender-ukpbj.spec.js \
  --workers=1 --headed
```

Jangan lanjut ke Flow 3 sebelum manifest menunjukkan `SENT_TO_POKJA`.

## Flow 3 — aturan Persyaratan Kualifikasi

Pada Flow 3, anggota Pokja pertama mengonfigurasi paket. Pokja kedua dan ketiga melanjutkan persetujuan paket yang sama.

### Pengadaan Barang biasa

Gunakan klasifikasi usaha dan persyaratan administrasi yang relevan. Jangan otomatis menambahkan KBKI pada bagian Persyaratan Kualifikasi.

Konfigurasi default automation sekarang adalah:

- Sumber klasifikasi: `KBLI`.
- Klasifikasi: `1075 - Industri Makanan`.
- Persyaratan administrasi: pilihan standar sesuai fixture.
- Persyaratan teknis berbasis pengalaman/KBKI: tidak dipilih.
- Tabel Data KBKI: tidak diisi.

KBKI hanya boleh ditambahkan jika dokumen atau skenario pengujian secara eksplisit mensyaratkan klasifikasi barang tersebut. Jangan menyimpulkan bahwa jenis `Pengadaan Barang` selalu memerlukan KBKI.

### Pekerjaan Konstruksi

Automation memilih persyaratan administrasi dan teknis konstruksi yang telah ditetapkan fixture. Tabel KBKI tidak digunakan karena kontrol tersebut tidak selalu tersedia pada formulir konstruksi.

### Skenario khusus yang benar-benar memerlukan KBKI

Aktifkan KBKI hanya dengan data skenario eksplisit:

```js
qualification: {
  technicalIndexes: [0],
  kbkiQuery: 'pipa',
}
```

Sebelum menyimpan, pastikan:

1. Persyaratan teknis yang dipilih memang meminta pengalaman berdasarkan KBKI.
2. Bagian `Tabel Data KBKI` tersedia pada halaman.
3. Kode/uraian KBKI yang dipilih relevan dengan paket.
4. Setelah disimpan, `Persyaratan Kualifikasi` pada halaman paket menampilkan tanda centang.

## Menjalankan Flow 3

```bash
SPSE_PACKAGE_MANIFEST='packages/web-automation/spse/runtime/packages/paket-baru.json' \
npm test --workspace=@automation/web -- \
  --project=spse \
  spse/tests/e2e/approve-non-tender-pokja.spec.js \
  --workers=1 --headed
```

Skrip dapat dilanjutkan dari status berikut:

- `SENT_TO_POKJA`
- `POKJA_1_APPROVED`
- `POKJA_2_APPROVED`
- `POKJA_APPROVED`

Automation melewati anggota yang sudah tercatat menyetujui paket. Paket dinyatakan selesai hanya jika manifest berisi `status: POKJA_APPROVED` dan tiga entri `pokjaApprovals`.

Verifikasi akhir:

```bash
jq '{packageName, procurementPackageId, status, pokjaApprovals}' \
  packages/web-automation/spse/runtime/packages/paket-baru.json
```

## Checklist sebelum menjalankan

1. VPN aktif dan halaman SPSE 2 dapat dibuka.
2. Kredensial PPK, Kepala UKPBJ, serta Pokja 1–3 tersedia di environment.
3. Manifest yang dipakai benar-benar milik paket yang dimaksud.
4. `metodePemilihan` pada manifest adalah `Penunjukan Langsung` untuk Flow 2–3.
5. Status paket sesuai dengan flow yang akan dijalankan.
6. Bila jadwal ditolak karena tanggal, periksa tanggal pada `Sesi Default` di bagian bawah halaman dan susun jadwal berdasarkan sesi tersebut.
7. Tanggal kirim undangan dapat memakai tanggal aktual karena saat ini tidak ada validasi khusus terhadap tanggal tersebut.
8. Setelah Flow 3, jangan hanya mengandalkan pesan test berhasil; periksa status dan tiga persetujuan pada manifest.

## Flow 4 — Penyedia menerima paket

Flow 4 hanya dijalankan setelah manifest berstatus `POKJA_APPROVED`. Penyedia membuka `Daftar Paket`, memilih tab `Non Tender`, membuka paket yang sama berdasarkan manifest, lalu menyetujui Pakta Integritas melalui tombol `Setuju & Ikut Paket`.

```bash
SPSE_PROVIDER_USERNAME='email-penyedia' \
SPSE_PROVIDER_PASSWORD='sandi-penyedia' \
SPSE_PACKAGE_MANIFEST='packages/web-automation/spse/runtime/packages/paket-baru.json' \
npm test --workspace=@automation/web -- \
  --project=spse \
  spse/tests/e2e/accept-non-tender-provider.spec.js \
  --workers=1 --headed
```

Kredensial tidak disimpan di source code. Setelah persetujuan, automation kembali ke `Beranda`, membuka daftar `Non Tender`, dan memastikan nama atau ID paket yang sama muncul pada tabel. Flow baru dianggap berhasil setelah validasi Beranda ini lolos. Manifest berubah menjadi `ACCEPTED_BY_PROVIDER` serta menyimpan nama, waktu penerimaan, dan `providerHomeValidatedAt`.

## Tanda masalah yang perlu dihentikan dan diperiksa

- `Persyaratan Kualifikasi` masih menampilkan ikon pensil: data belum tersimpan lengkap.
- Paket `Pengadaan Barang` biasa membuka dialog KBKI tanpa kebutuhan bisnis: konfigurasi skenario terlalu agresif.
- Paket konstruksi mencari elemen `Tabel Data KBKI`: cabang jenis pengadaan salah.
- Flow 3 dijalankan pada metode `Pengadaan Langsung`: jalur proses salah; paket seharusnya menuju Pejabat Pengadaan.
- Nama paket yang terbuka tidak sama persis dengan manifest: jangan melanjutkan perubahan atau persetujuan.

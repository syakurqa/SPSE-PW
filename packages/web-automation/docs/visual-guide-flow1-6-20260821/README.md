# Panduan Visual Menjalankan Flow 1–6 SPSE

Dokumen ini dibuat dari satu eksekusi headed berurutan pada staging SPSE 2. Setiap screenshot menampilkan titik tindakan yang ditandai oleh capture guide. Arahkan perhatian ke marker/lingkaran oranye pada gambar, kemudian ikuti instruksi **Klik**, **Isi**, **Pilih**, **Unggah**, atau **Download**.

## Paket yang digunakan

- **Package ID:** `01M0JHDKPG5FN4VX636KT6CWJ2`
- **Nama:** [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283
- **URL:** [Buka paket di SPSE 2](https://pengadaan-stg-2.eproc.dev/spse/paketnontender/01M0JHDKPG5FN4VX636KT6CWJ2/edit?step=3)
- **Satuan kerja:** DINAS KESEHATAN
- **Jenis / metode:** Pengadaan Barang / Penunjukan Langsung
- **Pagu:** Rp10.500.000.000
- **HPS:** Rp10.000.000.000
- **Status akhir:** `FLOW6_SUBMISSION_COMPLETED`

## Prasyarat dan konfigurasi

1. Pastikan VPN/staging dapat diakses dan gunakan base URL **https://pengadaan-stg-2.eproc.dev/spse/**.
2. Salin konfigurasi akun ke `.env` sesuai role (PPK, Kepala UKPBJ, Pokja 1–3, dan Penyedia). Jangan menaruh password di dokumentasi atau commit.
3. Jalankan dari root repository: `npm install`, lalu gunakan `ENV=SIT`.
4. Untuk jadwal pelatihan, pilih **Sesi #25** pada panel sesi di bagian bawah halaman. Flow 5 memakai `23-08-2026 10:00`; Flow 6 memakai `24-08-2026 10:00`. Tanggal undangan memakai tanggal real dan tidak divalidasi terhadap sesi.
5. Fixture utama: `packages/web-automation/spse/fixtures/data/flow5.data.js`, `packages/web-automation/spse/fixtures/data/flow6.data.js`, dan `packages/web-automation/spse/fixtures/data/pokja-approval.data.js`. Pilih subset data di fixture sebelum menjalankan ulang.

## Jalankan berurutan

Perintah berikut dipakai satu per satu. Flow berikutnya membaca manifest dari Flow 1, jadi jangan mengganti atau menghapus file manifest di tengah rangkaian.

```bash
SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
npm run test:spse:headed -- spse/tests/e2e/create-health-construction-non-tender.spec.js --project=spse --workers=1

SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
npm run test:spse:headed -- spse/tests/e2e/approve-health-construction-ukpbj.spec.js --project=spse --workers=1

SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
SPSE_POKJA_NAME="Cirebon Pokja Trial" npm run test:spse:headed -- spse/tests/e2e/approve-non-tender-pokja.spec.js --project=spse --workers=1

SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" npm run test:spse:headed -- spse/tests/e2e/accept-non-tender-provider.spec.js --project=spse --workers=1

SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" SPSE_POKJA_NAME="Cirebon Pokja Trial" npm run test:spse:headed -- spse/tests/e2e/flow5-explanation.spec.js --project=spse --workers=1

SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" npm run test:spse:headed -- spse/tests/e2e/flow6-qualification.spec.js --project=spse --workers=1

SPSE_PACKAGE_MANIFEST="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821/package-manifest.json" \
SPSE_GUIDE_CAPTURE=true \
SPSE_GUIDE_DIR="$PWD/packages/web-automation/docs/visual-guide-flow1-6-20260821" \
ENV=SIT \
SPSE_PROVIDER_USERNAME="$SPSE_PROVIDER_USERNAME" SPSE_PROVIDER_PASSWORD="$SPSE_PROVIDER_PASSWORD" npm run test:spse:headed -- spse/tests/e2e/flow6-offer.spec.js --project=spse --workers=1
```

## Ringkasan validasi hasil

| Flow | Status yang diharapkan | Hasil eksekusi |
|---|---|---|
| 1 | SENT_TO_UKPBJ | berhasil |
| 2 | SENT_TO_POKJA | berhasil |
| 3 | POKJA_APPROVED | berhasil (3 anggota) |
| 4 | ACCEPTED_BY_PROVIDER | berhasil + validasi Beranda |
| 5 | FLOW5_EXPLANATION_COMPLETED | berhasil (5 pertanyaan + 5 jawaban) |
| 6 | FLOW6_SUBMISSION_COMPLETED | berhasil |

## Flow 1 — PPK membuat paket Non-Tender

**Peran:** PPK / Dinas Kesehatan  
**Tujuan:** Membuat paket Pengadaan Barang dengan metode Penunjukan Langsung dan meneruskannya ke Kepala UKPBJ.

### Arahan singkat

- **Klik:** Klik LOGIN untuk masuk sebagai PPK. Halaman autentikasi INAPROC terbuka.
- **Isi:** Isi Alamat email akun PPK. Email siap diproses.
- **Klik:** Klik Lanjut setelah email PPK. Form Sandi ditampilkan.
- **Isi:** Isi Sandi PPK. Sandi tersimpan secara tersensor.
- **Pilih:** Pilih role PPK untuk satker yang sesuai. Dashboard PPK terbuka.
- **Klik:** Buka menu navigasi DAFTAR PAKET. Menu dropdown paket tampil.
- **Klik:** Klik tab Non Tender. Daftar paket Non Tender ditampilkan.
- **Klik:** Klik Buat Paket. Form pemilihan RUP terbuka.
- **Pilih:** Pilih Satuan Kerja DINAS KESEHATAN. RUP difilter untuk satuan kerja tersebut.
- **Pilih:** Pilih Metode Pemilihan Penunjukan Langsung. Tabel hanya menampilkan RUP dengan metode yang sesuai.
- **Pilih:** Pilih Jenis Pengadaan Pengadaan Barang. Jenis pengadaan paket terpilih.
- **Pilih:** Pilih checkbox RUP: 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - .... RUP terpilih untuk dibuat menjadi paket.
- **Isi:** Isi Nama Paket Non Tender. Nama paket tampil pada draft.
- **Klik:** Klik Selanjutnya menuju Dokumen Persiapan. Step 2 draft paket terbuka.
- **Klik:** Klik KBKI pada item 1. Modal pemilihan KBKI terbuka.
- **Klik:** Klik Cari KBKI. Daftar kode KBKI ditampilkan.
- **Pilih:** Pilih kode KBKI untuk item 1. Kode KBKI ditandai.
- **Klik:** Klik Simpan pada Rincian HPS. Rincian HPS dan KBKI tersimpan.
- **Klik:** Klik Kirim Email kepada Kepala UKPBJ. Status email berubah menjadi Sudah dikirim.
- **Klik:** Klik Simpan untuk membuat paket dan meneruskan ke Kepala UKPBJ. Data paket tersimpan dan manifest Flow 1 dibuat.

### Screenshot langkah

#### Langkah 1 — Klik LOGIN untuk masuk sebagai PPK

**Klik:** Halaman autentikasi INAPROC terbuka.

![Flow 1 langkah 1: Klik LOGIN untuk masuk sebagai PPK](./flow1/01-klik-login-untuk-masuk-sebagai-ppk.png)

#### Langkah 2 — Isi Alamat email akun PPK

**Isi:** Email siap diproses.

![Flow 1 langkah 2: Isi Alamat email akun PPK](./flow1/02-isi-alamat-email-akun-ppk.png)

#### Langkah 3 — Klik Lanjut setelah email PPK

**Klik:** Form Sandi ditampilkan.

![Flow 1 langkah 3: Klik Lanjut setelah email PPK](./flow1/03-klik-lanjut-setelah-email-ppk.png)

#### Langkah 4 — Isi Sandi PPK

**Isi:** Sandi tersimpan secara tersensor.

![Flow 1 langkah 4: Isi Sandi PPK](./flow1/04-isi-sandi-ppk.png)

#### Langkah 5 — Pilih role PPK untuk satker yang sesuai

**Pilih:** Dashboard PPK terbuka.

![Flow 1 langkah 5: Pilih role PPK untuk satker yang sesuai](./flow1/05-pilih-role-ppk-untuk-satker-yang-sesuai.png)

#### Langkah 6 — Buka menu navigasi DAFTAR PAKET

**Klik:** Menu dropdown paket tampil.

![Flow 1 langkah 6: Buka menu navigasi DAFTAR PAKET](./flow1/06-buka-menu-navigasi-daftar-paket.png)

#### Langkah 7 — Klik tab Non Tender

**Klik:** Daftar paket Non Tender ditampilkan.

![Flow 1 langkah 7: Klik tab Non Tender](./flow1/07-klik-tab-non-tender.png)

#### Langkah 8 — Klik Buat Paket

**Klik:** Form pemilihan RUP terbuka.

![Flow 1 langkah 8: Klik Buat Paket](./flow1/08-klik-buat-paket.png)

#### Langkah 9 — Pilih Satuan Kerja DINAS KESEHATAN

**Pilih:** RUP difilter untuk satuan kerja tersebut.

![Flow 1 langkah 9: Pilih Satuan Kerja DINAS KESEHATAN](./flow1/09-pilih-satuan-kerja-dinas-kesehatan.png)

#### Langkah 10 — Pilih Metode Pemilihan Penunjukan Langsung

**Pilih:** Tabel hanya menampilkan RUP dengan metode yang sesuai.

![Flow 1 langkah 10: Pilih Metode Pemilihan Penunjukan Langsung](./flow1/10-pilih-metode-pemilihan-penunjukan-langsung.png)

#### Langkah 11 — Pilih Jenis Pengadaan Pengadaan Barang

**Pilih:** Jenis pengadaan paket terpilih.

![Flow 1 langkah 11: Pilih Jenis Pengadaan Pengadaan Barang](./flow1/11-pilih-jenis-pengadaan-pengadaan-barang.png)

#### Langkah 12 — Pilih checkbox RUP: 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - ...

**Pilih:** RUP terpilih untuk dibuat menjadi paket.

![Flow 1 langkah 12: Pilih checkbox RUP: 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - ...](./flow1/12-pilih-checkbox-rup-65914625belanja-obat-obatan-obat-obatan-l.png)

#### Langkah 13 — Isi Nama Paket Non Tender

**Isi:** Nama paket tampil pada draft.

![Flow 1 langkah 13: Isi Nama Paket Non Tender](./flow1/13-isi-nama-paket-non-tender.png)

#### Langkah 14 — Klik Selanjutnya menuju Dokumen Persiapan

**Klik:** Step 2 draft paket terbuka.

![Flow 1 langkah 14: Klik Selanjutnya menuju Dokumen Persiapan](./flow1/14-klik-selanjutnya-menuju-dokumen-persiapan.png)

#### Langkah 15 — Klik KBKI pada item 1

**Klik:** Modal pemilihan KBKI terbuka.

![Flow 1 langkah 15: Klik KBKI pada item 1](./flow1/15-klik-kbki-pada-item-1.png)

#### Langkah 16 — Klik Cari KBKI

**Klik:** Daftar kode KBKI ditampilkan.

![Flow 1 langkah 16: Klik Cari KBKI](./flow1/16-klik-cari-kbki.png)

#### Langkah 17 — Pilih kode KBKI untuk item 1

**Pilih:** Kode KBKI ditandai.

![Flow 1 langkah 17: Pilih kode KBKI untuk item 1](./flow1/17-pilih-kode-kbki-untuk-item-1.png)

#### Langkah 18 — Klik Simpan pada Rincian HPS

**Klik:** Rincian HPS dan KBKI tersimpan.

![Flow 1 langkah 18: Klik Simpan pada Rincian HPS](./flow1/18-klik-simpan-pada-rincian-hps.png)

#### Langkah 19 — Klik Kirim Email kepada Kepala UKPBJ

**Klik:** Status email berubah menjadi Sudah dikirim.

![Flow 1 langkah 19: Klik Kirim Email kepada Kepala UKPBJ](./flow1/19-klik-kirim-email-kepada-kepala-ukpbj.png)

#### Langkah 20 — Klik Simpan untuk membuat paket dan meneruskan ke Kepala UKPBJ

**Klik:** Data paket tersimpan dan manifest Flow 1 dibuat.

![Flow 1 langkah 20: Klik Simpan untuk membuat paket dan meneruskan ke Kepala UKPBJ](./flow1/20-klik-simpan-untuk-membuat-paket-dan-meneruskan-ke-kepala-ukp.png)

## Flow 2 — Kepala UKPBJ meneruskan paket ke Pokja

**Peran:** Kepala UKPBJ  
**Tujuan:** Memverifikasi paket yang dibuat PPK dan mengirimkannya kepada Pokja.

### Arahan singkat

- **Klik:** Klik LOGIN untuk masuk sebagai Kepala UKPBJ. Halaman autentikasi INAPROC terbuka.
- **Isi:** Isi Alamat email akun Kepala UKPBJ. Email siap diproses.
- **Klik:** Klik Lanjut setelah email Kepala UKPBJ. Form Sandi ditampilkan.
- **Isi:** Isi Sandi Kepala UKPBJ. Sandi tersimpan secara tersensor.
- **Klik:** Klik Lanjutkan tanpa Security Key. Halaman pemilihan role ditampilkan.
- **Pilih:** Pilih role Kepala UKPBJ. Dashboard Kepala UKPBJ terbuka.
- **Klik:** Klik menu Non Tender pada akun Kepala UKPBJ. Daftar paket yang perlu diverifikasi ditampilkan.
- **Klik:** Klik paket exact [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283. Detail paket Flow 1 terbuka.

### Screenshot langkah

#### Langkah 1 — Klik LOGIN untuk masuk sebagai Kepala UKPBJ

**Klik:** Halaman autentikasi INAPROC terbuka.

![Flow 2 langkah 1: Klik LOGIN untuk masuk sebagai Kepala UKPBJ](./flow2/01-klik-login-untuk-masuk-sebagai-kepala-ukpbj.png)

#### Langkah 2 — Isi Alamat email akun Kepala UKPBJ

**Isi:** Email siap diproses.

![Flow 2 langkah 2: Isi Alamat email akun Kepala UKPBJ](./flow2/02-isi-alamat-email-akun-kepala-ukpbj.png)

#### Langkah 3 — Klik Lanjut setelah email Kepala UKPBJ

**Klik:** Form Sandi ditampilkan.

![Flow 2 langkah 3: Klik Lanjut setelah email Kepala UKPBJ](./flow2/03-klik-lanjut-setelah-email-kepala-ukpbj.png)

#### Langkah 4 — Isi Sandi Kepala UKPBJ

**Isi:** Sandi tersimpan secara tersensor.

![Flow 2 langkah 4: Isi Sandi Kepala UKPBJ](./flow2/04-isi-sandi-kepala-ukpbj.png)

#### Langkah 5 — Klik Lanjutkan tanpa Security Key

**Klik:** Halaman pemilihan role ditampilkan.

![Flow 2 langkah 5: Klik Lanjutkan tanpa Security Key](./flow2/05-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 6 — Klik Lanjutkan tanpa Security Key

**Klik:** Halaman pemilihan role ditampilkan.

![Flow 2 langkah 6: Klik Lanjutkan tanpa Security Key](./flow2/06-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 7 — Pilih role Kepala UKPBJ

**Pilih:** Dashboard Kepala UKPBJ terbuka.

![Flow 2 langkah 7: Pilih role Kepala UKPBJ](./flow2/07-pilih-role-kepala-ukpbj.png)

#### Langkah 8 — Klik menu Non Tender pada akun Kepala UKPBJ

**Klik:** Daftar paket yang perlu diverifikasi ditampilkan.

![Flow 2 langkah 8: Klik menu Non Tender pada akun Kepala UKPBJ](./flow2/08-klik-menu-non-tender-pada-akun-kepala-ukpbj.png)

#### Langkah 9 — Klik paket exact [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283

**Klik:** Detail paket Flow 1 terbuka.

![Flow 2 langkah 9: Klik paket exact [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283](./flow2/09-klik-paket-exact-qa-penunjukan-langsung-automation-070-65914.png)

## Flow 3 — Tiga anggota Pokja menyetujui paket

**Peran:** Pokja 1, Pokja 2, Pokja 3  
**Tujuan:** Mengisi jadwal, kualifikasi/KBKI bila diperlukan, dokumen persiapan, penyedia, lalu menyetujui Pakta Integritas secara berurutan.

### Arahan singkat

- **Klik:** Klik LOGIN untuk masuk sebagai anggota Pokja. Halaman autentikasi ditampilkan.
- **Isi:** Isi Alamat email anggota Pokja. Email siap diproses.
- **Isi:** Isi Sandi anggota Pokja. Sandi tersimpan secara tersensor.
- **Klik:** Klik Lanjutkan tanpa Security Key. Proses login Pokja berlanjut.
- **Pilih:** Pilih role Anggota Pokja Pemilihan Kota Cirebon. Dashboard Pokja terbuka.
- **Klik:** Klik DAFTAR PAKET pada dashboard Pokja. Daftar paket Pokja ditampilkan.
- **Klik:** Klik tab Non Tender. Paket Penunjukan Langsung ditampilkan.
- **Klik:** Klik Buat Non Tender pada paket yang ditugaskan. Halaman konfigurasi paket terbuka.
- **Klik:** Klik Jadwal Paket. Form sembilan tahap jadwal terbuka.
- **Klik:** Klik Simpan setelah jadwal H+1 sampai H+9 diisi. Semua Jadwal berhasil tersimpan.
- **Klik:** Klik Persyaratan Kualifikasi. Form klasifikasi dan persyaratan terbuka.
- **Klik:** Klik Masa Berlaku Penawaran. Field masa berlaku ditampilkan.
- **Isi:** Isi masa berlaku penawaran 90 hari. Masa berlaku tersimpan.
- **Klik:** Klik Dokumen Penawaran. Daftar persyaratan dokumen ditampilkan.
- **Unggah:** Klik Upload pada Dokumen Pemilihan (SDP). Form upload SDP terbuka.
- **Klik:** Klik Kirim untuk membuat undangan reviu DPP. Form undangan ditampilkan.
- **Klik:** Klik Kirim Pesan untuk mengirim undangan. Undangan reviu DPP berhasil terkirim.
- **Unggah:** Klik Upload untuk mengunggah BA hasil reviu. Form upload BA reviu terbuka.
- **Klik:** Klik Pilih Penyedia. Halaman pencarian penyedia terbuka.
- **Pilih:** Centang penyedia ANGSAE. Penyedia target ditandai.
- **Klik:** Klik Setuju pada Pakta Integritas. Persetujuan anggota Pokja tercatat.

### Screenshot langkah

#### Langkah 1 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 3 langkah 1: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow3/01-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 2 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 3 langkah 2: Isi Alamat email anggota Pokja](./flow3/02-isi-alamat-email-anggota-pokja.png)

#### Langkah 3 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 3 langkah 3: Isi Sandi anggota Pokja](./flow3/03-isi-sandi-anggota-pokja.png)

#### Langkah 4 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 3 langkah 4: Klik Lanjutkan tanpa Security Key](./flow3/04-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 5 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 3 langkah 5: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow3/05-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 6 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 3 langkah 6: Klik DAFTAR PAKET pada dashboard Pokja](./flow3/06-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 7 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 3 langkah 7: Klik tab Non Tender](./flow3/07-klik-tab-non-tender.png)

#### Langkah 8 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 3 langkah 8: Klik Buat Non Tender pada paket yang ditugaskan](./flow3/08-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 9 — Klik Jadwal Paket

**Klik:** Form sembilan tahap jadwal terbuka.

![Flow 3 langkah 9: Klik Jadwal Paket](./flow3/09-klik-jadwal-paket.png)

#### Langkah 10 — Klik Simpan setelah jadwal H+1 sampai H+9 diisi

**Klik:** Semua Jadwal berhasil tersimpan.

![Flow 3 langkah 10: Klik Simpan setelah jadwal H+1 sampai H+9 diisi](./flow3/10-klik-simpan-setelah-jadwal-h-1-sampai-h-9-diisi.png)

#### Langkah 11 — Klik Persyaratan Kualifikasi

**Klik:** Form klasifikasi dan persyaratan terbuka.

![Flow 3 langkah 11: Klik Persyaratan Kualifikasi](./flow3/11-klik-persyaratan-kualifikasi.png)

#### Langkah 1 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 3 langkah 1: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow3/01-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 2 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 3 langkah 2: Isi Alamat email anggota Pokja](./flow3/02-isi-alamat-email-anggota-pokja.png)

#### Langkah 3 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 3 langkah 3: Isi Sandi anggota Pokja](./flow3/03-isi-sandi-anggota-pokja.png)

#### Langkah 4 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 3 langkah 4: Klik Lanjutkan tanpa Security Key](./flow3/04-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 5 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 3 langkah 5: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow3/05-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 6 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 3 langkah 6: Klik DAFTAR PAKET pada dashboard Pokja](./flow3/06-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 7 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 3 langkah 7: Klik tab Non Tender](./flow3/07-klik-tab-non-tender.png)

#### Langkah 8 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 3 langkah 8: Klik Buat Non Tender pada paket yang ditugaskan](./flow3/08-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 9 — Klik Jadwal Paket

**Klik:** Form sembilan tahap jadwal terbuka.

![Flow 3 langkah 9: Klik Jadwal Paket](./flow3/09-klik-jadwal-paket.png)

#### Langkah 10 — Klik Simpan setelah jadwal H+1 sampai H+9 diisi

**Klik:** Semua Jadwal berhasil tersimpan.

![Flow 3 langkah 10: Klik Simpan setelah jadwal H+1 sampai H+9 diisi](./flow3/10-klik-simpan-setelah-jadwal-h-1-sampai-h-9-diisi.png)

#### Langkah 11 — Klik Persyaratan Kualifikasi

**Klik:** Form klasifikasi dan persyaratan terbuka.

![Flow 3 langkah 11: Klik Persyaratan Kualifikasi](./flow3/11-klik-persyaratan-kualifikasi.png)

#### Langkah 12 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 3 langkah 12: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow3/12-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 13 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 3 langkah 13: Isi Alamat email anggota Pokja](./flow3/13-isi-alamat-email-anggota-pokja.png)

#### Langkah 14 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 3 langkah 14: Isi Sandi anggota Pokja](./flow3/14-isi-sandi-anggota-pokja.png)

#### Langkah 15 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 3 langkah 15: Klik Lanjutkan tanpa Security Key](./flow3/15-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 16 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 3 langkah 16: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow3/16-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 17 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 3 langkah 17: Klik DAFTAR PAKET pada dashboard Pokja](./flow3/17-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 18 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 3 langkah 18: Klik tab Non Tender](./flow3/18-klik-tab-non-tender.png)

#### Langkah 19 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 3 langkah 19: Klik Buat Non Tender pada paket yang ditugaskan](./flow3/19-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 20 — Klik Jadwal Paket

**Klik:** Form sembilan tahap jadwal terbuka.

![Flow 3 langkah 20: Klik Jadwal Paket](./flow3/20-klik-jadwal-paket.png)

#### Langkah 21 — Klik Simpan setelah jadwal H+1 sampai H+9 diisi

**Klik:** Semua Jadwal berhasil tersimpan.

![Flow 3 langkah 21: Klik Simpan setelah jadwal H+1 sampai H+9 diisi](./flow3/21-klik-simpan-setelah-jadwal-h-1-sampai-h-9-diisi.png)

#### Langkah 22 — Klik Persyaratan Kualifikasi

**Klik:** Form klasifikasi dan persyaratan terbuka.

![Flow 3 langkah 22: Klik Persyaratan Kualifikasi](./flow3/22-klik-persyaratan-kualifikasi.png)

#### Langkah 23 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 3 langkah 23: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow3/23-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 24 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 3 langkah 24: Isi Alamat email anggota Pokja](./flow3/24-isi-alamat-email-anggota-pokja.png)

#### Langkah 25 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 3 langkah 25: Isi Sandi anggota Pokja](./flow3/25-isi-sandi-anggota-pokja.png)

#### Langkah 26 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 3 langkah 26: Klik Lanjutkan tanpa Security Key](./flow3/26-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 27 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 3 langkah 27: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow3/27-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 28 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 3 langkah 28: Klik DAFTAR PAKET pada dashboard Pokja](./flow3/28-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 29 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 3 langkah 29: Klik tab Non Tender](./flow3/29-klik-tab-non-tender.png)

#### Langkah 30 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 3 langkah 30: Klik Buat Non Tender pada paket yang ditugaskan](./flow3/30-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 31 — Klik Jadwal Paket

**Klik:** Form sembilan tahap jadwal terbuka.

![Flow 3 langkah 31: Klik Jadwal Paket](./flow3/31-klik-jadwal-paket.png)

#### Langkah 32 — Klik Simpan setelah jadwal H+1 sampai H+9 diisi

**Klik:** Semua Jadwal berhasil tersimpan.

![Flow 3 langkah 32: Klik Simpan setelah jadwal H+1 sampai H+9 diisi](./flow3/32-klik-simpan-setelah-jadwal-h-1-sampai-h-9-diisi.png)

#### Langkah 33 — Klik Persyaratan Kualifikasi

**Klik:** Form klasifikasi dan persyaratan terbuka.

![Flow 3 langkah 33: Klik Persyaratan Kualifikasi](./flow3/33-klik-persyaratan-kualifikasi.png)

#### Langkah 34 — Klik Masa Berlaku Penawaran

**Klik:** Field masa berlaku ditampilkan.

![Flow 3 langkah 34: Klik Masa Berlaku Penawaran](./flow3/34-klik-masa-berlaku-penawaran.png)

#### Langkah 35 — Isi masa berlaku penawaran 90 hari

**Isi:** Masa berlaku tersimpan.

![Flow 3 langkah 35: Isi masa berlaku penawaran 90 hari](./flow3/35-isi-masa-berlaku-penawaran-90-hari.png)

#### Langkah 36 — Klik Dokumen Penawaran

**Klik:** Daftar persyaratan dokumen ditampilkan.

![Flow 3 langkah 36: Klik Dokumen Penawaran](./flow3/36-klik-dokumen-penawaran.png)

#### Langkah 37 — Klik Upload pada Dokumen Pemilihan (SDP)

**Unggah:** Form upload SDP terbuka.

![Flow 3 langkah 37: Klik Upload pada Dokumen Pemilihan (SDP)](./flow3/37-klik-upload-pada-dokumen-pemilihan-sdp.png)

#### Langkah 38 — Klik Kirim untuk membuat undangan reviu DPP

**Klik:** Form undangan ditampilkan.

![Flow 3 langkah 38: Klik Kirim untuk membuat undangan reviu DPP](./flow3/38-klik-kirim-untuk-membuat-undangan-reviu-dpp.png)

#### Langkah 39 — Klik Kirim Pesan untuk mengirim undangan

**Klik:** Undangan reviu DPP berhasil terkirim.

![Flow 3 langkah 39: Klik Kirim Pesan untuk mengirim undangan](./flow3/39-klik-kirim-pesan-untuk-mengirim-undangan.png)

#### Langkah 40 — Klik Upload untuk mengunggah BA hasil reviu

**Unggah:** Form upload BA reviu terbuka.

![Flow 3 langkah 40: Klik Upload untuk mengunggah BA hasil reviu](./flow3/40-klik-upload-untuk-mengunggah-ba-hasil-reviu.png)

#### Langkah 41 — Klik Pilih Penyedia

**Klik:** Halaman pencarian penyedia terbuka.

![Flow 3 langkah 41: Klik Pilih Penyedia](./flow3/41-klik-pilih-penyedia.png)

#### Langkah 42 — Centang penyedia ANGSAE

**Pilih:** Penyedia target ditandai.

![Flow 3 langkah 42: Centang penyedia ANGSAE](./flow3/42-centang-penyedia-angsae.png)

#### Langkah 43 — Klik Setuju pada Pakta Integritas

**Klik:** Persetujuan anggota Pokja tercatat.

![Flow 3 langkah 43: Klik Setuju pada Pakta Integritas](./flow3/43-klik-setuju-pada-pakta-integritas.png)

#### Langkah 44 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 3 langkah 44: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow3/44-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 45 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 3 langkah 45: Isi Alamat email anggota Pokja](./flow3/45-isi-alamat-email-anggota-pokja.png)

#### Langkah 46 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 3 langkah 46: Isi Sandi anggota Pokja](./flow3/46-isi-sandi-anggota-pokja.png)

#### Langkah 47 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 3 langkah 47: Klik Lanjutkan tanpa Security Key](./flow3/47-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 48 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 3 langkah 48: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow3/48-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 49 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 3 langkah 49: Klik DAFTAR PAKET pada dashboard Pokja](./flow3/49-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 50 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 3 langkah 50: Klik tab Non Tender](./flow3/50-klik-tab-non-tender.png)

#### Langkah 51 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 3 langkah 51: Klik Buat Non Tender pada paket yang ditugaskan](./flow3/51-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 52 — Klik Setuju pada Pakta Integritas

**Klik:** Persetujuan anggota Pokja tercatat.

![Flow 3 langkah 52: Klik Setuju pada Pakta Integritas](./flow3/52-klik-setuju-pada-pakta-integritas.png)

#### Langkah 53 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 3 langkah 53: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow3/53-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 54 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 3 langkah 54: Isi Alamat email anggota Pokja](./flow3/54-isi-alamat-email-anggota-pokja.png)

#### Langkah 55 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 3 langkah 55: Isi Sandi anggota Pokja](./flow3/55-isi-sandi-anggota-pokja.png)

#### Langkah 56 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 3 langkah 56: Klik Lanjutkan tanpa Security Key](./flow3/56-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 57 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 3 langkah 57: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow3/57-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 58 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 3 langkah 58: Klik DAFTAR PAKET pada dashboard Pokja](./flow3/58-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 59 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 3 langkah 59: Klik tab Non Tender](./flow3/59-klik-tab-non-tender.png)

#### Langkah 60 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 3 langkah 60: Klik Buat Non Tender pada paket yang ditugaskan](./flow3/60-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 61 — Klik Setuju pada Pakta Integritas

**Klik:** Persetujuan anggota Pokja tercatat.

![Flow 3 langkah 61: Klik Setuju pada Pakta Integritas](./flow3/61-klik-setuju-pada-pakta-integritas.png)

## Flow 4 — Penyedia menyetujui dan mengikuti paket

**Peran:** Penyedia / Angsae Baru  
**Tujuan:** Membaca Pakta Integritas, klik Setuju & Ikut Paket, lalu memastikan paket masuk ke Beranda penyedia.

### Arahan singkat

- **Klik:** Klik LOGIN untuk masuk sebagai anggota Pokja. Halaman autentikasi ditampilkan.
- **Isi:** Isi Alamat email akun Penyedia. Email Penyedia siap diproses.
- **Isi:** Isi Sandi akun Penyedia. Sandi tersimpan secara tersensor.
- **Klik:** Klik Lanjutkan tanpa Security Key. Proses login Pokja berlanjut.
- **Klik:** Klik DAFTAR PAKET atau PAKET BARU. Daftar paket yang tersedia bagi Penyedia terbuka.
- **Klik:** Pilih tab Non Tender. Tabel paket Non Tender ditampilkan.
- **Klik:** Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283. Detail dan Pakta Integritas paket ditampilkan.
- **Klik:** Klik Setuju & Ikut Paket. Penyedia menyetujui Pakta Integritas dan menerima paket.
- **Klik:** Kembali ke Beranda setelah menerima paket. Beranda Penyedia dan daftar Paket Untuk Anda ditampilkan.
- **Validasi:** Pastikan paket yang disetujui muncul di Beranda. Paket tercantum pada daftar Non Tender di Beranda Penyedia.

### Screenshot langkah

#### Langkah 1 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 4 langkah 1: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow4/01-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 2 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 4 langkah 2: Isi Alamat email akun Penyedia](./flow4/02-isi-alamat-email-akun-penyedia.png)

#### Langkah 3 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 4 langkah 3: Isi Sandi akun Penyedia](./flow4/03-isi-sandi-akun-penyedia.png)

#### Langkah 4 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 4 langkah 4: Klik Lanjutkan tanpa Security Key](./flow4/04-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 5 — Klik DAFTAR PAKET atau PAKET BARU

**Klik:** Daftar paket yang tersedia bagi Penyedia terbuka.

![Flow 4 langkah 5: Klik DAFTAR PAKET atau PAKET BARU](./flow4/05-klik-daftar-paket-atau-paket-baru.png)

#### Langkah 6 — Pilih tab Non Tender

**Klik:** Tabel paket Non Tender ditampilkan.

![Flow 4 langkah 6: Pilih tab Non Tender](./flow4/06-pilih-tab-non-tender.png)

#### Langkah 7 — Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283

**Klik:** Detail dan Pakta Integritas paket ditampilkan.

![Flow 4 langkah 7: Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283](./flow4/07-buka-paket-qa-penunjukan-langsung-automation-070-65914625bel.png)

#### Langkah 8 — Klik Setuju & Ikut Paket

**Klik:** Penyedia menyetujui Pakta Integritas dan menerima paket.

![Flow 4 langkah 8: Klik Setuju & Ikut Paket](./flow4/08-klik-setuju-ikut-paket.png)

#### Langkah 9 — Kembali ke Beranda setelah menerima paket

**Klik:** Beranda Penyedia dan daftar Paket Untuk Anda ditampilkan.

![Flow 4 langkah 9: Kembali ke Beranda setelah menerima paket](./flow4/09-kembali-ke-beranda-setelah-menerima-paket.png)

#### Langkah 10 — Pastikan paket yang disetujui muncul di Beranda

**Validasi:** Paket tercantum pada daftar Non Tender di Beranda Penyedia.

![Flow 4 langkah 10: Pastikan paket yang disetujui muncul di Beranda](./flow4/10-pastikan-paket-yang-disetujui-muncul-di-beranda.png)

## Flow 5 — Tahap 1: Pemberian Penjelasan

**Peran:** Penyedia lalu Pokja  
**Tujuan:** Mengaktifkan sesi 25, mengirim lima pertanyaan (dua dengan lampiran), lalu Pokja menjawab semuanya dan mengunduh lampiran.

### Arahan singkat

- **Klik:** Klik LOGIN untuk masuk sebagai anggota Pokja. Halaman autentikasi ditampilkan.
- **Isi:** Isi Alamat email akun Penyedia. Email Penyedia siap diproses.
- **Isi:** Isi Sandi akun Penyedia. Sandi tersimpan secara tersensor.
- **Klik:** Klik Lanjutkan tanpa Security Key. Proses login Pokja berlanjut.
- **Pilih:** Pilih Sesi #25. Sesi #25 menjadi sesi pelatihan aktif.
- **Isi:** Ubah waktu Sesi #25 menjadi 23-08-2026 10:00 WIB. Waktu sesi berada dalam tahap Pemberian Penjelasan.
- **Klik:** Klik BERANDA untuk membuka paket yang telah diikuti. Beranda dan daftar paket yang diikuti Penyedia terbuka.
- **Klik:** Pilih tab Non Tender. Tabel paket Non Tender ditampilkan.
- **Klik:** Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283. Detail paket yang telah diikuti Penyedia ditampilkan.
- **Klik:** Buka tab Pertanyaan dan Penjelasan. Forum Pemberian Penjelasan paket terbuka.
- **Klik:** Klik Kirim Pertanyaan untuk pertanyaan 1. Form pertanyaan terbuka.
- **Klik:** Kirim pertanyaan 1. Pertanyaan 1 tersimpan pada forum.
- **Klik:** Klik Kirim Pertanyaan untuk pertanyaan 2. Form pertanyaan terbuka.
- **Klik:** Kirim pertanyaan 2. Pertanyaan 2 tersimpan pada forum.
- **Klik:** Klik Kirim Pertanyaan untuk pertanyaan 3. Form pertanyaan terbuka.
- **Klik:** Kirim pertanyaan 3. Pertanyaan 3 tersimpan pada forum.
- **Klik:** Klik Kirim Pertanyaan untuk pertanyaan 4. Form pertanyaan terbuka.
- **Klik:** Kirim pertanyaan 4. Pertanyaan 4 tersimpan pada forum.
- **Klik:** Klik Kirim Pertanyaan untuk pertanyaan 5. Form pertanyaan terbuka.
- **Klik:** Kirim pertanyaan 5. Pertanyaan 5 tersimpan pada forum.
- **Download:** Penyedia mengunduh lampiran 1. File selesai diunduh dan tidak kosong.
- **Download:** Penyedia mengunduh lampiran 2. File selesai diunduh dan tidak kosong.
- **Isi:** Isi Alamat email anggota Pokja. Email siap diproses.
- **Isi:** Isi Sandi anggota Pokja. Sandi tersimpan secara tersensor.
- **Pilih:** Pilih role Anggota Pokja Pemilihan Kota Cirebon. Dashboard Pokja terbuka.
- **Klik:** Klik DAFTAR PAKET pada dashboard Pokja. Daftar paket Pokja ditampilkan.
- **Klik:** Klik tab Non Tender. Paket Penunjukan Langsung ditampilkan.
- **Klik:** Klik Buat Non Tender pada paket yang ditugaskan. Halaman konfigurasi paket terbuka.
- **Klik:** Klik Jawab untuk pertanyaan 1. Editor jawaban Pokja ditampilkan.
- **Klik:** Kirim penjelasan untuk pertanyaan 1. Penjelasan 1 tersimpan dan counter bertambah.
- **Klik:** Klik Jawab untuk pertanyaan 2. Editor jawaban Pokja ditampilkan.
- **Klik:** Kirim penjelasan untuk pertanyaan 2. Penjelasan 2 tersimpan dan counter bertambah.
- **Klik:** Klik Jawab untuk pertanyaan 3. Editor jawaban Pokja ditampilkan.
- **Klik:** Kirim penjelasan untuk pertanyaan 3. Penjelasan 3 tersimpan dan counter bertambah.
- **Klik:** Klik Jawab untuk pertanyaan 4. Editor jawaban Pokja ditampilkan.
- **Klik:** Kirim penjelasan untuk pertanyaan 4. Penjelasan 4 tersimpan dan counter bertambah.
- **Klik:** Klik Jawab untuk pertanyaan 5. Editor jawaban Pokja ditampilkan.
- **Klik:** Kirim penjelasan untuk pertanyaan 5. Penjelasan 5 tersimpan dan counter bertambah.
- **Download:** Pokja mengunduh lampiran 1. File selesai diunduh dan tidak kosong.
- **Download:** Pokja mengunduh lampiran 2. File selesai diunduh dan tidak kosong.

### Screenshot langkah

#### Langkah 1 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 5 langkah 1: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow5/01-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 2 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 5 langkah 2: Isi Alamat email akun Penyedia](./flow5/02-isi-alamat-email-akun-penyedia.png)

#### Langkah 3 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 5 langkah 3: Isi Sandi akun Penyedia](./flow5/03-isi-sandi-akun-penyedia.png)

#### Langkah 4 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 5 langkah 4: Klik Lanjutkan tanpa Security Key](./flow5/04-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 5 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 5 langkah 5: Pilih Sesi #25](./flow5/05-pilih-sesi-25.png)

#### Langkah 6 — Ubah waktu Sesi #25 menjadi 23-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 5 langkah 6: Ubah waktu Sesi #25 menjadi 23-08-2026 10:00 WIB](./flow5/06-ubah-waktu-sesi-25-menjadi-23-08-2026-10-00-wib.png)

#### Langkah 7 — Klik BERANDA untuk membuka paket yang telah diikuti

**Klik:** Beranda dan daftar paket yang diikuti Penyedia terbuka.

![Flow 5 langkah 7: Klik BERANDA untuk membuka paket yang telah diikuti](./flow5/07-klik-beranda-untuk-membuka-paket-yang-telah-diikuti.png)

#### Langkah 8 — Pilih tab Non Tender

**Klik:** Tabel paket Non Tender ditampilkan.

![Flow 5 langkah 8: Pilih tab Non Tender](./flow5/08-pilih-tab-non-tender.png)

#### Langkah 9 — Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283

**Klik:** Detail paket yang telah diikuti Penyedia ditampilkan.

![Flow 5 langkah 9: Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283](./flow5/09-buka-paket-qa-penunjukan-langsung-automation-070-65914625bel.png)

#### Langkah 10 — Buka tab Pertanyaan dan Penjelasan

**Klik:** Forum Pemberian Penjelasan paket terbuka.

![Flow 5 langkah 10: Buka tab Pertanyaan dan Penjelasan](./flow5/10-buka-tab-pertanyaan-dan-penjelasan.png)

#### Langkah 11 — Klik Kirim Pertanyaan untuk pertanyaan 1

**Klik:** Form pertanyaan terbuka.

![Flow 5 langkah 11: Klik Kirim Pertanyaan untuk pertanyaan 1](./flow5/11-klik-kirim-pertanyaan-untuk-pertanyaan-1.png)

#### Langkah 12 — Kirim pertanyaan 1

**Klik:** Pertanyaan 1 tersimpan pada forum.

![Flow 5 langkah 12: Kirim pertanyaan 1](./flow5/12-kirim-pertanyaan-1.png)

#### Langkah 13 — Klik Kirim Pertanyaan untuk pertanyaan 2

**Klik:** Form pertanyaan terbuka.

![Flow 5 langkah 13: Klik Kirim Pertanyaan untuk pertanyaan 2](./flow5/13-klik-kirim-pertanyaan-untuk-pertanyaan-2.png)

#### Langkah 14 — Kirim pertanyaan 2

**Klik:** Pertanyaan 2 tersimpan pada forum.

![Flow 5 langkah 14: Kirim pertanyaan 2](./flow5/14-kirim-pertanyaan-2.png)

#### Langkah 15 — Klik Kirim Pertanyaan untuk pertanyaan 3

**Klik:** Form pertanyaan terbuka.

![Flow 5 langkah 15: Klik Kirim Pertanyaan untuk pertanyaan 3](./flow5/15-klik-kirim-pertanyaan-untuk-pertanyaan-3.png)

#### Langkah 16 — Kirim pertanyaan 3

**Klik:** Pertanyaan 3 tersimpan pada forum.

![Flow 5 langkah 16: Kirim pertanyaan 3](./flow5/16-kirim-pertanyaan-3.png)

#### Langkah 17 — Klik Kirim Pertanyaan untuk pertanyaan 4

**Klik:** Form pertanyaan terbuka.

![Flow 5 langkah 17: Klik Kirim Pertanyaan untuk pertanyaan 4](./flow5/17-klik-kirim-pertanyaan-untuk-pertanyaan-4.png)

#### Langkah 18 — Kirim pertanyaan 4

**Klik:** Pertanyaan 4 tersimpan pada forum.

![Flow 5 langkah 18: Kirim pertanyaan 4](./flow5/18-kirim-pertanyaan-4.png)

#### Langkah 19 — Klik Kirim Pertanyaan untuk pertanyaan 5

**Klik:** Form pertanyaan terbuka.

![Flow 5 langkah 19: Klik Kirim Pertanyaan untuk pertanyaan 5](./flow5/19-klik-kirim-pertanyaan-untuk-pertanyaan-5.png)

#### Langkah 20 — Kirim pertanyaan 5

**Klik:** Pertanyaan 5 tersimpan pada forum.

![Flow 5 langkah 20: Kirim pertanyaan 5](./flow5/20-kirim-pertanyaan-5.png)

#### Langkah 21 — Penyedia mengunduh lampiran 1

**Download:** File selesai diunduh dan tidak kosong.

![Flow 5 langkah 21: Penyedia mengunduh lampiran 1](./flow5/21-penyedia-mengunduh-lampiran-1.png)

#### Langkah 22 — Penyedia mengunduh lampiran 2

**Download:** File selesai diunduh dan tidak kosong.

![Flow 5 langkah 22: Penyedia mengunduh lampiran 2](./flow5/22-penyedia-mengunduh-lampiran-2.png)

#### Langkah 23 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 5 langkah 23: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow5/23-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 24 — Isi Alamat email anggota Pokja

**Isi:** Email siap diproses.

![Flow 5 langkah 24: Isi Alamat email anggota Pokja](./flow5/24-isi-alamat-email-anggota-pokja.png)

#### Langkah 25 — Isi Sandi anggota Pokja

**Isi:** Sandi tersimpan secara tersensor.

![Flow 5 langkah 25: Isi Sandi anggota Pokja](./flow5/25-isi-sandi-anggota-pokja.png)

#### Langkah 26 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 5 langkah 26: Klik Lanjutkan tanpa Security Key](./flow5/26-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 27 — Pilih role Anggota Pokja Pemilihan Kota Cirebon

**Pilih:** Dashboard Pokja terbuka.

![Flow 5 langkah 27: Pilih role Anggota Pokja Pemilihan Kota Cirebon](./flow5/27-pilih-role-anggota-pokja-pemilihan-kota-cirebon.png)

#### Langkah 28 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 5 langkah 28: Pilih Sesi #25](./flow5/28-pilih-sesi-25.png)

#### Langkah 29 — Ubah waktu Sesi #25 menjadi 23-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 5 langkah 29: Ubah waktu Sesi #25 menjadi 23-08-2026 10:00 WIB](./flow5/29-ubah-waktu-sesi-25-menjadi-23-08-2026-10-00-wib.png)

#### Langkah 30 — Klik DAFTAR PAKET pada dashboard Pokja

**Klik:** Daftar paket Pokja ditampilkan.

![Flow 5 langkah 30: Klik DAFTAR PAKET pada dashboard Pokja](./flow5/30-klik-daftar-paket-pada-dashboard-pokja.png)

#### Langkah 31 — Klik tab Non Tender

**Klik:** Paket Penunjukan Langsung ditampilkan.

![Flow 5 langkah 31: Klik tab Non Tender](./flow5/31-klik-tab-non-tender.png)

#### Langkah 32 — Klik Buat Non Tender pada paket yang ditugaskan

**Klik:** Halaman konfigurasi paket terbuka.

![Flow 5 langkah 32: Klik Buat Non Tender pada paket yang ditugaskan](./flow5/32-klik-buat-non-tender-pada-paket-yang-ditugaskan.png)

#### Langkah 33 — Buka tab Pertanyaan dan Penjelasan

**Klik:** Forum Pemberian Penjelasan paket terbuka.

![Flow 5 langkah 33: Buka tab Pertanyaan dan Penjelasan](./flow5/33-buka-tab-pertanyaan-dan-penjelasan.png)

#### Langkah 34 — Klik Jawab untuk pertanyaan 1

**Klik:** Editor jawaban Pokja ditampilkan.

![Flow 5 langkah 34: Klik Jawab untuk pertanyaan 1](./flow5/34-klik-jawab-untuk-pertanyaan-1.png)

#### Langkah 35 — Kirim penjelasan untuk pertanyaan 1

**Klik:** Penjelasan 1 tersimpan dan counter bertambah.

![Flow 5 langkah 35: Kirim penjelasan untuk pertanyaan 1](./flow5/35-kirim-penjelasan-untuk-pertanyaan-1.png)

#### Langkah 36 — Klik Jawab untuk pertanyaan 2

**Klik:** Editor jawaban Pokja ditampilkan.

![Flow 5 langkah 36: Klik Jawab untuk pertanyaan 2](./flow5/36-klik-jawab-untuk-pertanyaan-2.png)

#### Langkah 37 — Kirim penjelasan untuk pertanyaan 2

**Klik:** Penjelasan 2 tersimpan dan counter bertambah.

![Flow 5 langkah 37: Kirim penjelasan untuk pertanyaan 2](./flow5/37-kirim-penjelasan-untuk-pertanyaan-2.png)

#### Langkah 38 — Klik Jawab untuk pertanyaan 3

**Klik:** Editor jawaban Pokja ditampilkan.

![Flow 5 langkah 38: Klik Jawab untuk pertanyaan 3](./flow5/38-klik-jawab-untuk-pertanyaan-3.png)

#### Langkah 39 — Kirim penjelasan untuk pertanyaan 3

**Klik:** Penjelasan 3 tersimpan dan counter bertambah.

![Flow 5 langkah 39: Kirim penjelasan untuk pertanyaan 3](./flow5/39-kirim-penjelasan-untuk-pertanyaan-3.png)

#### Langkah 40 — Klik Jawab untuk pertanyaan 4

**Klik:** Editor jawaban Pokja ditampilkan.

![Flow 5 langkah 40: Klik Jawab untuk pertanyaan 4](./flow5/40-klik-jawab-untuk-pertanyaan-4.png)

#### Langkah 41 — Kirim penjelasan untuk pertanyaan 4

**Klik:** Penjelasan 4 tersimpan dan counter bertambah.

![Flow 5 langkah 41: Kirim penjelasan untuk pertanyaan 4](./flow5/41-kirim-penjelasan-untuk-pertanyaan-4.png)

#### Langkah 42 — Klik Jawab untuk pertanyaan 5

**Klik:** Editor jawaban Pokja ditampilkan.

![Flow 5 langkah 42: Klik Jawab untuk pertanyaan 5](./flow5/42-klik-jawab-untuk-pertanyaan-5.png)

#### Langkah 43 — Kirim penjelasan untuk pertanyaan 5

**Klik:** Penjelasan 5 tersimpan dan counter bertambah.

![Flow 5 langkah 43: Kirim penjelasan untuk pertanyaan 5](./flow5/43-kirim-penjelasan-untuk-pertanyaan-5.png)

#### Langkah 44 — Pokja mengunduh lampiran 1

**Download:** File selesai diunduh dan tidak kosong.

![Flow 5 langkah 44: Pokja mengunduh lampiran 1](./flow5/44-pokja-mengunduh-lampiran-1.png)

#### Langkah 45 — Pokja mengunduh lampiran 2

**Download:** File selesai diunduh dan tidak kosong.

![Flow 5 langkah 45: Pokja mengunduh lampiran 2](./flow5/45-pokja-mengunduh-lampiran-2.png)

## Flow 6 — Tahap 2: Upload Dokumen Penawaran

**Peran:** Penyedia / Angsae Baru  
**Tujuan:** Mengirim kualifikasi, Surat Penawaran, enam dokumen teknis, dua lampiran harga, harga + PPN 11%, dan TKDN/PDN.

### Arahan singkat

- **Klik:** Klik LOGIN untuk masuk sebagai anggota Pokja. Halaman autentikasi ditampilkan.
- **Isi:** Isi Alamat email akun Penyedia. Email Penyedia siap diproses.
- **Isi:** Isi Sandi akun Penyedia. Sandi tersimpan secara tersensor.
- **Klik:** Klik Lanjutkan tanpa Security Key. Proses login Pokja berlanjut.
- **Pilih:** Pilih Sesi #25. Sesi #25 menjadi sesi pelatihan aktif.
- **Isi:** Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB. Waktu sesi berada dalam tahap Pemberian Penjelasan.
- **Klik:** Klik BERANDA untuk membuka paket yang telah diikuti. Beranda dan daftar paket yang diikuti Penyedia terbuka.
- **Klik:** Pilih tab Non Tender. Tabel paket Non Tender ditampilkan.
- **Klik:** Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283. Detail paket yang telah diikuti Penyedia ditampilkan.
- **Klik:** Klik Kirim Data/Ubah Data pada Dokumen Kualifikasi. Wizard Data Kualifikasi terbuka.
- **Klik:** Klik Kirim Data Kualifikasi. Konfirmasi pengiriman Data Kualifikasi ditampilkan.
- **Klik:** Klik Kirim Penawaran. Tahap Surat Penawaran ditampilkan.
- **Isi:** Isi masa berlaku penawaran 90 hari. Masa berlaku Surat Penawaran terisi.
- **Klik:** Klik Setuju pada Surat Penawaran. Surat Penawaran disetujui dan tahap teknis dibuka.
- **Isi:** Isi nilai TKDN/PDN 20%. Total PDN dihitung dari total penawaran.
- **Klik:** Klik Simpan pada Penawaran Harga. Rincian harga, PPN, dan TKDN tersimpan.

### Screenshot langkah

#### Langkah 1 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 6 langkah 1: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow6/01-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 2 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 6 langkah 2: Isi Alamat email akun Penyedia](./flow6/02-isi-alamat-email-akun-penyedia.png)

#### Langkah 3 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 6 langkah 3: Isi Sandi akun Penyedia](./flow6/03-isi-sandi-akun-penyedia.png)

#### Langkah 4 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 6 langkah 4: Klik Lanjutkan tanpa Security Key](./flow6/04-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 5 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 6 langkah 5: Pilih Sesi #25](./flow6/05-pilih-sesi-25.png)

#### Langkah 6 — Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 6 langkah 6: Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB](./flow6/06-ubah-waktu-sesi-25-menjadi-24-08-2026-10-00-wib.png)

#### Langkah 7 — Klik BERANDA untuk membuka paket yang telah diikuti

**Klik:** Beranda dan daftar paket yang diikuti Penyedia terbuka.

![Flow 6 langkah 7: Klik BERANDA untuk membuka paket yang telah diikuti](./flow6/07-klik-beranda-untuk-membuka-paket-yang-telah-diikuti.png)

#### Langkah 8 — Pilih tab Non Tender

**Klik:** Tabel paket Non Tender ditampilkan.

![Flow 6 langkah 8: Pilih tab Non Tender](./flow6/08-pilih-tab-non-tender.png)

#### Langkah 9 — Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283

**Klik:** Detail paket yang telah diikuti Penyedia ditampilkan.

![Flow 6 langkah 9: Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283](./flow6/09-buka-paket-qa-penunjukan-langsung-automation-070-65914625bel.png)

#### Langkah 10 — Klik Kirim Data/Ubah Data pada Dokumen Kualifikasi

**Klik:** Wizard Data Kualifikasi terbuka.

![Flow 6 langkah 10: Klik Kirim Data/Ubah Data pada Dokumen Kualifikasi](./flow6/10-klik-kirim-data-ubah-data-pada-dokumen-kualifikasi.png)

#### Langkah 11 — Klik Kirim Data Kualifikasi

**Klik:** Konfirmasi pengiriman Data Kualifikasi ditampilkan.

![Flow 6 langkah 11: Klik Kirim Data Kualifikasi](./flow6/11-klik-kirim-data-kualifikasi.png)

#### Langkah 1 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 6 langkah 1: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow6/01-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 2 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 6 langkah 2: Isi Alamat email akun Penyedia](./flow6/02-isi-alamat-email-akun-penyedia.png)

#### Langkah 3 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 6 langkah 3: Isi Sandi akun Penyedia](./flow6/03-isi-sandi-akun-penyedia.png)

#### Langkah 4 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 6 langkah 4: Klik Lanjutkan tanpa Security Key](./flow6/04-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 5 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 6 langkah 5: Pilih Sesi #25](./flow6/05-pilih-sesi-25.png)

#### Langkah 6 — Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 6 langkah 6: Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB](./flow6/06-ubah-waktu-sesi-25-menjadi-24-08-2026-10-00-wib.png)

#### Langkah 7 — Klik BERANDA untuk membuka paket yang telah diikuti

**Klik:** Beranda dan daftar paket yang diikuti Penyedia terbuka.

![Flow 6 langkah 7: Klik BERANDA untuk membuka paket yang telah diikuti](./flow6/07-klik-beranda-untuk-membuka-paket-yang-telah-diikuti.png)

#### Langkah 8 — Pilih tab Non Tender

**Klik:** Tabel paket Non Tender ditampilkan.

![Flow 6 langkah 8: Pilih tab Non Tender](./flow6/08-pilih-tab-non-tender.png)

#### Langkah 9 — Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283

**Klik:** Detail paket yang telah diikuti Penyedia ditampilkan.

![Flow 6 langkah 9: Buka paket [QA] [Penunjukan Langsung] [Automation] [070] - 65914625Belanja Obat-Obatan-Obat-Obatan Lainnya - Bahan Reagent (5.1.02.01.01.0038.06)BLUDPenunjukan LangsungRp 10,5 M2026Pengadaan BarangDINAS KESEHATAN - 1787328648283](./flow6/09-buka-paket-qa-penunjukan-langsung-automation-070-65914625bel.png)

#### Langkah 10 — Klik Kirim Penawaran

**Klik:** Tahap Surat Penawaran ditampilkan.

![Flow 6 langkah 10: Klik Kirim Penawaran](./flow6/10-klik-kirim-penawaran.png)

#### Langkah 11 — Isi masa berlaku penawaran 90 hari

**Isi:** Masa berlaku Surat Penawaran terisi.

![Flow 6 langkah 11: Isi masa berlaku penawaran 90 hari](./flow6/11-isi-masa-berlaku-penawaran-90-hari.png)

#### Langkah 12 — Klik Setuju pada Surat Penawaran

**Klik:** Surat Penawaran disetujui dan tahap teknis dibuka.

![Flow 6 langkah 12: Klik Setuju pada Surat Penawaran](./flow6/12-klik-setuju-pada-surat-penawaran.png)

#### Langkah 13 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 6 langkah 13: Isi Alamat email akun Penyedia](./flow6/13-isi-alamat-email-akun-penyedia.png)

#### Langkah 14 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 6 langkah 14: Isi Sandi akun Penyedia](./flow6/14-isi-sandi-akun-penyedia.png)

#### Langkah 15 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 6 langkah 15: Klik Lanjutkan tanpa Security Key](./flow6/15-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 16 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 6 langkah 16: Pilih Sesi #25](./flow6/16-pilih-sesi-25.png)

#### Langkah 17 — Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 6 langkah 17: Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB](./flow6/17-ubah-waktu-sesi-25-menjadi-24-08-2026-10-00-wib.png)

#### Langkah 18 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 6 langkah 18: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow6/18-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 19 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 6 langkah 19: Isi Alamat email akun Penyedia](./flow6/19-isi-alamat-email-akun-penyedia.png)

#### Langkah 20 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 6 langkah 20: Isi Sandi akun Penyedia](./flow6/20-isi-sandi-akun-penyedia.png)

#### Langkah 21 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 6 langkah 21: Klik Lanjutkan tanpa Security Key](./flow6/21-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 22 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 6 langkah 22: Pilih Sesi #25](./flow6/22-pilih-sesi-25.png)

#### Langkah 23 — Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 6 langkah 23: Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB](./flow6/23-ubah-waktu-sesi-25-menjadi-24-08-2026-10-00-wib.png)

#### Langkah 24 — Isi nilai TKDN/PDN 20%

**Isi:** Total PDN dihitung dari total penawaran.

![Flow 6 langkah 24: Isi nilai TKDN/PDN 20%](./flow6/24-isi-nilai-tkdn-pdn-20.png)

#### Langkah 25 — Klik Simpan pada Penawaran Harga

**Klik:** Rincian harga, PPN, dan TKDN tersimpan.

![Flow 6 langkah 25: Klik Simpan pada Penawaran Harga](./flow6/25-klik-simpan-pada-penawaran-harga.png)

#### Langkah 26 — Klik LOGIN untuk masuk sebagai anggota Pokja

**Klik:** Halaman autentikasi ditampilkan.

![Flow 6 langkah 26: Klik LOGIN untuk masuk sebagai anggota Pokja](./flow6/26-klik-login-untuk-masuk-sebagai-anggota-pokja.png)

#### Langkah 27 — Isi Alamat email akun Penyedia

**Isi:** Email Penyedia siap diproses.

![Flow 6 langkah 27: Isi Alamat email akun Penyedia](./flow6/27-isi-alamat-email-akun-penyedia.png)

#### Langkah 28 — Isi Sandi akun Penyedia

**Isi:** Sandi tersimpan secara tersensor.

![Flow 6 langkah 28: Isi Sandi akun Penyedia](./flow6/28-isi-sandi-akun-penyedia.png)

#### Langkah 29 — Klik Lanjutkan tanpa Security Key

**Klik:** Proses login Pokja berlanjut.

![Flow 6 langkah 29: Klik Lanjutkan tanpa Security Key](./flow6/29-klik-lanjutkan-tanpa-security-key.png)

#### Langkah 30 — Pilih Sesi #25

**Pilih:** Sesi #25 menjadi sesi pelatihan aktif.

![Flow 6 langkah 30: Pilih Sesi #25](./flow6/30-pilih-sesi-25.png)

#### Langkah 31 — Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB

**Isi:** Waktu sesi berada dalam tahap Pemberian Penjelasan.

![Flow 6 langkah 31: Ubah waktu Sesi #25 menjadi 24-08-2026 10:00 WIB](./flow6/31-ubah-waktu-sesi-25-menjadi-24-08-2026-10-00-wib.png)

## Catatan hasil aktual

- Flow 3 sempat menemukan katalog KBKI kosong pada respons pertama. Implementasi sekarang melakukan retry pencarian huruf `b`, menunggu data async, membuka ulang dropdown, dan mengulang konteks Pokja; eksekusi ini berhasil menyelesaikan ketiga persetujuan.
- Pada Flow 6, nilai sebelum PPN Rp9.000.000.000, PPN 11% Rp990.000.000, total Rp9.990.000.000 (di bawah HPS Rp10.000.000.000).
- Dua lampiran pertanyaan Flow 5, enam upload teknis Flow 6, dan dua lampiran harga tervalidasi dengan nama file, ukuran, hash SHA-256, dan/atau download.
- UI staging saat ini tidak mengekspos link TTE/Bukti Penyampaian Penawaran; validasi akhir mencatat status tersebut sebagai `NOT_EXPOSED_BY_CURRENT_UI`.
- Server menerima payload Total PDN, tetapi setelah reload input persentase PDN kembali `0`; ini dicatat di manifest sebagai `tkdnPersisted: false` dan bukan kegagalan pengiriman harga.

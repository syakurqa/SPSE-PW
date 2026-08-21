# Panduan Flow 5 — Pemberian Penjelasan

Flow 5 menjalankan tahap pertama dari sembilan tahap Penunjukan Langsung Pascakualifikasi, yaitu `Pemberian Penjelasan`.

## Jadwal paket

1. Pemberian Penjelasan
2. Upload Dokumen Penawaran
3. Evaluasi Administrasi, Kualifikasi, Teknis, dan Harga
4. Pembuktian Kualifikasi
5. Klarifikasi dan Negosiasi Teknis dan Harga
6. Penetapan Pemenang
7. Pengumuman Pemenang
8. Surat Penunjukan Penyedia Barang/Jasa
9. Penandatanganan Kontrak

## Alur Penyedia

1. Login sebagai Angsae Baru — Penyedia.
2. Pilih Sesi Pelatihan `Sesi #25`.
3. Ubah waktu Sesi #25 ke waktu yang berada di dalam rentang tahap Pemberian Penjelasan paket.
4. Buka `Beranda`, lalu daftar `Non Tender`.
5. Cari dan buka paket berdasarkan nama/ID manifest Flow 4.
6. Pastikan tahap paket saat ini adalah `Pemberian Penjelasan`.
7. Buka tab `Pertanyaan dan Penjelasan`.
8. Kirim lima pertanyaan yang relevan dengan paket. Pertanyaan pertama dan kedua menggunakan lampiran.
9. Unduh dua lampiran pertanyaan dan pastikan kedua file berhasil serta tidak kosong.
10. Pastikan counter menunjukkan `Pertanyaan 5 dan Penjelasan 0`.

## Alur Pokja

1. Login sebagai Pokja 1 dengan sesi browser terpisah.
2. Pilih Sesi Pelatihan `Sesi #25` dan set waktu yang sama.
3. Buka `Daftar Paket → Non Tender`, cari paket yang sama, lalu buka halaman informasi paket.
4. Buka tab `Pertanyaan dan Penjelasan`.
5. Jawab kelima pertanyaan secara berurutan dengan uraian yang relevan dan cukup detail.
6. Unduh dua lampiran pertanyaan sebagai Pokja dan pastikan kedua file berhasil serta tidak kosong.
7. Pastikan counter akhir menunjukkan `Pertanyaan 5 dan Penjelasan 5`.

## Menjalankan automation

```bash
SPSE_PROVIDER_USERNAME='email-penyedia' \
SPSE_PROVIDER_PASSWORD='sandi-penyedia' \
SPSE_PACKAGE_MANIFEST='packages/web-automation/spse/runtime/packages/paket.json' \
npm test --workspace=@automation/web -- \
  --project=spse \
  spse/tests/e2e/flow5-explanation.spec.js \
  --workers=1 --headed
```

Kredensial Pokja 1 dibaca dari `SPSE_POKJA_1_USERNAME` dan `SPSE_POKJA_1_PASSWORD`. Kredensial tidak disimpan dalam source code.

Automation bersifat resumable. Jumlah pertanyaan dan jawaban yang telah berhasil diproses disimpan di manifest, sedangkan counter aktual pada UI digunakan untuk mencegah pengiriman ulang. Status akhir yang benar adalah `FLOW5_EXPLANATION_COMPLETED` dengan nilai `flow5ProviderQuestionCount: 5` dan `flow5PokjaAnswerCount: 5`. Bukti download kedua peran disimpan dalam `flow5ProviderAttachmentDownloads` dan `flow5PokjaAttachmentDownloads`, termasuk nama serta ukuran file.

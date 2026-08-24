import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ProviderOfferPage } from '../pom/paket/provider-offer.page.js';

const offerPage = new ProviderOfferPage({});

test('bukti upload wajib sama dengan isi file yang diunduh dari server', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spse-upload-'));
  const filePath = path.join(directory, 'offer.pdf');
  const contents = Buffer.from('fixture penawaran');
  fs.writeFileSync(filePath, contents);
  const verifier = new ProviderOfferPage({});

  try {
    verifier.downloadEvidence = async () => ({
      fileName: 'offer.pdf',
      size: contents.length,
      sha256: verifier.hashFile(filePath),
      url: '/download/offer.pdf',
    });
    const evidence = await verifier.verifyUploadedFile(
      {},
      filePath,
      'Dokumen Teknis'
    );
    assert.equal(evidence.downloadVerified, true);

    verifier.downloadEvidence = async () => ({
      fileName: 'offer.pdf',
      size: contents.length,
      sha256: 'hash-file-lain',
      url: '/download/offer.pdf',
    });
    await assert.rejects(
      verifier.verifyUploadedFile({}, filePath, 'Dokumen Teknis'),
      /tidak sama dengan fixture lokal/
    );
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});

test('status Kualifikasi membedakan belum dan sudah dikirim', () => {
  assert.equal(offerPage.hasQualificationBeenSent(
    'Dokumen Kualifikasi Status: Belum dikirim'
  ), false);
  assert.equal(offerPage.hasQualificationBeenSent(
    'Dokumen Kualifikasi Status: Sudah dikirim Lihat Data Ubah Data'
  ), true);
  assert.throws(() => offerPage.hasQualificationBeenSent(
    'Dokumen Kualifikasi Status: Diproses'
  ), /tidak dikenali/);
});

test('status Surat Penawaran membedakan belum dan sudah kirim', () => {
  assert.equal(offerPage.hasOfferLetterBeenSent(
    'Surat Penawaran : Belum Kirim'
  ), false);
  assert.equal(offerPage.hasOfferLetterBeenSent(
    'Surat Penawaran : Sudah Kirim'
  ), true);
  assert.throws(() => offerPage.hasOfferLetterBeenSent(
    'Surat Penawaran : Status Aneh'
  ), /tidak dikenali/);
});

test('status Dokumen Teknis membedakan belum dan sudah kirim', () => {
  assert.equal(offerPage.hasTechnicalOfferBeenSent(
    'Dokumen Teknis : Belum Kirim'
  ), false);
  assert.equal(offerPage.hasTechnicalOfferBeenSent(
    'Dokumen Teknis : Terkirim'
  ), true);
});

test('status Dokumen Harga juga memvalidasi total penawaran', () => {
  assert.equal(offerPage.hasPriceOfferBeenSent(
    'Dokumen Harga : Belum Kirim',
    9_990_000_000
  ), false);
  assert.equal(offerPage.hasPriceOfferBeenSent(
    'Dokumen Harga : Sudah Kirim Total Penawaran : Rp. 9.990.000.000,00',
    9_990_000_000
  ), true);
  assert.throws(() => offerPage.hasPriceOfferBeenSent(
    'Dokumen Harga : Sudah Kirim Total Penawaran : Rp. 9.000.000.000,00',
    9_990_000_000
  ), /Total Penawaran tidak sesuai/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHealthGoodsDirectAppointmentData,
  createNonTenderTestData,
} from '../fixtures/data/non-tender.data.js';

test('factory Flow 1 canonical membentuk skenario barang Rp10 miliar', () => {
  const data = createHealthGoodsDirectAppointmentData({ runId: 'qa-run', });

  assert.equal(data.selection.satkerQuery, 'DINAS KESEHATAN');
  assert.equal(data.selection.metodeLabel, 'Penunjukan Langsung');
  assert.equal(data.selection.jenisPengadaanLabel, 'Pengadaan Barang');
  assert.equal(data.selection.minimumPagu, 10_000_000_000);
  assert.equal(data.package.kbkiItems[0].harga, 10_000_000_000);
  assert.equal(data.package.requiresKbki, true);
  assert.match(data.package.createName({
    metodeLabel: 'Penunjukan Langsung',
    nama: 'Paket QA',
  }), /\[qa-run\].*Paket QA/);
});

test('factory Flow 1 mempertahankan index RUP 1-based dan boolean KBKI', () => {
  const data = createNonTenderTestData({
    rupIndex: 2,
    requiresKbki: false,
  });
  assert.equal(data.selection.rupIndex, 2);
  assert.equal(data.package.requiresKbki, false);

  assert.throws(() => createNonTenderTestData({ rupIndex: 0, }), /rupIndex/);
  assert.throws(() => createNonTenderTestData({ requiresKbki: 'yes', }),
    /requiresKbki/);
});

test('factory tidak memaksa KBKI pada Pengadaan Barang biasa', () => {
  const goods = createNonTenderTestData({ jenisPengadaanLabel: 'Pengadaan Barang', });
  const construction = createNonTenderTestData({ jenisPengadaanLabel: 'Pekerjaan Konstruksi', });

  assert.equal(goods.package.requiresKbki, false);
  assert.equal(construction.package.requiresKbki, true);
});

test('factory Flow 1 menolak HPS kosong, string, atau non-positif', () => {
  assert.throws(() => createNonTenderTestData({ kbkiItems: [], }),
    /minimal satu item/);
  assert.throws(() => createNonTenderTestData({
    kbkiItems: [{
      jenisBarang: 'Barang',
      satuan: 'paket',
      harga: '10000000',
      keterangan: 'HPS',
      query: 'b',
      selectText: 'Barang',
    }],
  }), /harga wajib berupa number positif/);
  assert.throws(() => createNonTenderTestData({
    kbkiItems: [{
      jenisBarang: 'Barang',
      satuan: 'paket',
      harga: 0,
      keterangan: 'HPS',
      query: 'b',
      selectText: 'Barang',
    }],
  }), /harga wajib berupa number positif/);
});

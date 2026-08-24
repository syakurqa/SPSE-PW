import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'path';
import { createFlow6Data, flow6Data } from '../fixtures/data/flow6.data.js';

test('Flow 6 factory mempertahankan nilai default dan export lama', () => {
  const data = createFlow6Data({}, {});

  assert.equal(data.sessionNumber, 25);
  assert.equal(data.offerTime, '24-08-2026 10:00');
  assert.equal(data.qualification.businessPermits, 'all');
  assert.equal(data.qualification.personnel, 'all');
  assert.equal(data.qualification.experience, 'all');
  assert.equal(data.qualification.ongoingWork, 'all');
  assert.equal(data.qualification.equipment, 'all');
  assert.equal(data.offer.validityDays, 90);
  assert.equal(data.offer.priceBeforeVat, 9000000000);
  assert.equal(data.offer.vatPercent, 11);
  assert.equal(data.offer.tkdnPercent, 20);
  assert.equal(data.offer.priceRequirementFiles.length, 2);
  assert.deepEqual(flow6Data, createFlow6Data());
});

test('Flow 6 factory membaca selection, angka, waktu, dan file dari environment', () => {
  const data = createFlow6Data({}, {
    SPSE_FLOW6_SESSION_NUMBER: '32',
    SPSE_FLOW6_OFFER_TIME: '31-08-2026 09:30',
    SPSE_FLOW6_BUSINESS_PERMITS: '0,2,2',
    SPSE_FLOW6_PERSONNEL: 'none',
    SPSE_FLOW6_EXPERIENCE: '[1,3]',
    SPSE_FLOW6_ONGOING_WORK: 'all',
    SPSE_FLOW6_EQUIPMENT: '[]',
    SPSE_FLOW6_OTHER_REQUIREMENT_FILE: './fixtures/qualification.pdf',
    SPSE_FLOW6_VALIDITY_DAYS: '120',
    SPSE_FLOW6_TECHNICAL_FILE: './fixtures/technical.zip',
    SPSE_FLOW6_PRICE_REQUIREMENT_FILES: '["./fixtures/price.pdf",null]',
    SPSE_FLOW6_PRICE_BEFORE_VAT: '8500000000',
    SPSE_FLOW6_VAT_PERCENT: '11',
    SPSE_FLOW6_TKDN_PERCENT: '35.5',
  });

  assert.equal(data.sessionNumber, 32);
  assert.equal(data.offerTime, '31-08-2026 09:30');
  assert.deepEqual(data.qualification.businessPermits, [0, 2]);
  assert.deepEqual(data.qualification.personnel, []);
  assert.deepEqual(data.qualification.experience, [1, 3]);
  assert.equal(data.qualification.ongoingWork, 'all');
  assert.deepEqual(data.qualification.equipment, []);
  assert.equal(
    data.qualification.otherRequirementFile,
    path.resolve('./fixtures/qualification.pdf')
  );
  assert.equal(data.offer.validityDays, 120);
  assert.equal(
    data.offer.technicalFile,
    path.resolve('./fixtures/technical.zip')
  );
  assert.deepEqual(data.offer.priceRequirementFiles, [
    path.resolve('./fixtures/price.pdf'),
    null,
  ]);
  assert.equal(data.offer.priceBeforeVat, 8500000000);
  assert.equal(data.offer.vatPercent, 11);
  assert.equal(data.offer.tkdnPercent, 35.5);
});

test('Flow 6 factory memberi prioritas pada override eksplisit', () => {
  const data = createFlow6Data({
    sessionNumber: 44,
    qualification: { personnel: [4], },
    offer: {
      vatPercent: 10,
      tkdnPercent: 50,
    },
  }, {
    SPSE_FLOW6_SESSION_NUMBER: '45',
    SPSE_FLOW6_PERSONNEL: 'all',
    SPSE_FLOW6_VAT_PERCENT: '12',
    SPSE_FLOW6_TKDN_PERCENT: '25',
  });

  assert.equal(data.sessionNumber, 44);
  assert.deepEqual(data.qualification.personnel, [4]);
  assert.equal(data.offer.vatPercent, 10);
  assert.equal(data.offer.tkdnPercent, 50);
});

test('Flow 6 factory mendukung file teknis per persyaratan', () => {
  const data = createFlow6Data({
    offer: {
      technicalFile: {
        defaultFile: './fixtures/default.pdf',
        byRequirementId: { 101: './fixtures/id-101.zip', },
        byRequirementName: { Brosur: './fixtures/brosur.pdf', },
      },
    },
  }, {});

  assert.deepEqual(data.offer.technicalFile, {
    defaultFile: path.resolve('./fixtures/default.pdf'),
    byRequirementId: { 101: path.resolve('./fixtures/id-101.zip'), },
    byRequirementName: { Brosur: path.resolve('./fixtures/brosur.pdf'), },
  });
});

test('Flow 6 factory menolak selection yang tidak valid', () => {
  assert.throws(() => createFlow6Data({ qualification: { experience: [-1], }, },
    {}), /qualification.experience/);
  assert.throws(() => createFlow6Data({}, { SPSE_FLOW6_PERSONNEL: 'a,b', }),
    /qualification.personnel/);
});

test('Flow 6 factory menolak rentang angka dan file yang tidak valid', () => {
  assert.throws(() => createFlow6Data({ offer: { priceBeforeVat: 0, }, }, {}),
    /offer.priceBeforeVat/);
  assert.throws(() => createFlow6Data({ offer: { vatPercent: 101, }, }, {}),
    /offer.vatPercent/);
  assert.throws(() => createFlow6Data({ offer: { tkdnPercent: -1, }, }, {}),
    /offer.tkdnPercent/);
  assert.throws(() => createFlow6Data({ offer: { validityDays: 1.5, }, }, {}),
    /offer.validityDays/);
  const invalidFile = { offer: { technicalFile: './fixtures/script.exe', }, };
  assert.throws(() => createFlow6Data(invalidFile, {}),
    /offer.technicalFile harus menggunakan file PDF atau ZIP/);
  assert.throws(() => createFlow6Data({ offer: { technicalFile: { byRequirementName: { Brosur: './fixtures/script.exe', }, }, }, }, {}), /offer.technicalFile.byRequirementName.Brosur/);
});

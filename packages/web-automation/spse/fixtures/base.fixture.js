import { test as base } from '@playwright/test';
import { env } from '../../../common-module/config/index.js';
import { LoginPage } from '../pom/auth/login.page.js';
import { UkpbjLoginPage } from '../pom/auth/ukpbj-login.page.js';
import { NonTenderPage } from '../pom/paket/non-tender.page.js';
import { TenderPage } from '../pom/paket/tender.page.js';
import { FormPaketPage } from '../pom/paket/form-paket.page.js';
import { FormTenderPage } from '../pom/paket/form-tender.page.js';
import { UkpbjApprovalPage } from '../pom/paket/ukpbj-approval.page.js';
import { createNonTenderTestData } from './data/non-tender.data.js';
import { createTenderTestData } from './data/tender.data.js';
import { loadUkpbjApprovalData } from './data/ukpbj-approval.data.js';
import { loadPokjaApprovalData } from './data/pokja-approval.data.js';

export const test = base.extend({
  // 0. Global Auto-Accept untuk semua dialog/popup JavaScript (alert, confirm, prompt)
  page: async ({ page }, use) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await use(page);
  },

  // 1. Kredensial User PPK & URL (Murni membaca dari env.sit.json / env.uat.json)
  // eslint-disable-next-line no-empty-pattern
  userPPK: async ({}, use) => {
    await use(env.SPSE_PLATFORM.USER.PPK);
  },

  // Akun PPK khusus untuk jalur Pengadaan Langsung → Pejabat Pengadaan.
  // eslint-disable-next-line no-empty-pattern
  userPPKPP: async ({}, use) => {
    await use({
      username: process.env.SPSE_PPK_PP_USERNAME,
      password: process.env.SPSE_PPK_PP_PASSWORD,
    });
  },

  // eslint-disable-next-line no-empty-pattern
  userUKPBJ: async ({}, use) => {
    await use({
      username: process.env.SPSE_UKPBJ_USERNAME,
      password: process.env.SPSE_UKPBJ_PASSWORD,
    });
  },

  // eslint-disable-next-line no-empty-pattern
  spseBaseUrl: async ({}, use) => {
    await use(env.SPSE_PLATFORM.BASE_URL);
  },

  // 2. Data test skenario. Seluruh nilai skenario berada di data fixture,
  // bukan di Page Object.
  // eslint-disable-next-line no-empty-pattern
  nonTenderData: async ({}, use) => {
    await use(createNonTenderTestData({
      metodeLabel: process.env.SPSE_METODE_PEMILIHAN
        || 'Penunjukan Langsung',
      jenisPengadaanLabel: process.env.SPSE_JENIS_PENGADAAN
        || 'Pekerjaan Konstruksi'
    }));
  },

  // eslint-disable-next-line no-empty-pattern
  nonTenderPPData: async ({}, use) => {
    await use(createNonTenderTestData({
      satkerQuery: 'DINAS KESEHATAN',
      metodeLabel: 'Pengadaan Langsung',
      jenisPengadaanLabel: 'Pengadaan Barang',
      rupName: null,
      rupIndex: Number(process.env.SPSE_PPK_PP_RUP_INDEX || 1),
    }));
  },

  // Varian Flow 1/2: Dinas Kesehatan, Pengadaan Barang, Penunjukan Langsung,
  // dengan RUP bernilai di atas Rp10 miliar dan HPS tepat Rp10 miliar.
  // eslint-disable-next-line no-empty-pattern
  nonTenderHealthConstructionData: async ({}, use) => {
    const data = createNonTenderTestData({
      satkerQuery: 'DINAS KESEHATAN',
      metodeLabel: 'Penunjukan Langsung',
      jenisPengadaanLabel: 'Pengadaan Barang',
      rupName: null,
      rupIndex: 1,
    });
    data.selection.minimumPagu = 10_000_000_000;
    data.package.kbkiItems = [{
      jenisBarang: 'Pipa',
      satuan: 'paket',
      harga: '10000000000',
      keterangan: 'Nilai HPS pengadaan barang Rp10 miliar',
      query: 'pipa',
      selectText: 'Pipa/ slang kain',
    }];
    await use(data);
  },

  // eslint-disable-next-line no-empty-pattern
  tenderData: async ({}, use) => {
    await use(createTenderTestData({
      metodeLabel: process.env.SPSE_TENDER_METODE || 'Tender',
      satkerQuery: process.env.SPSE_TENDER_SATKER
        || 'DINAS LINGKUNGAN HIDUP',
      rupIndex: Number(process.env.SPSE_TENDER_RUP_INDEX || 1),
    }));
  },

  // eslint-disable-next-line no-empty-pattern
  ukpbjApprovalData: async ({}, use) => {
    await use(loadUkpbjApprovalData({
      manifestPath: process.env.SPSE_PACKAGE_MANIFEST,
      pokjaName: process.env.SPSE_POKJA_NAME,
      pokjaIndex: Number(process.env.SPSE_POKJA_INDEX || 1),
    }));
  },

  // eslint-disable-next-line no-empty-pattern
  pokjaApprovalData: async ({}, use) => {
    await use(loadPokjaApprovalData({ manifestPath: process.env.SPSE_PACKAGE_MANIFEST, }));
  },

  // 3. Page Object Fixtures
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  ukpbjLoginPage: async ({ page }, use) => {
    await use(new UkpbjLoginPage(page));
  },
  nonTenderPage: async ({ page }, use) => {
    await use(new NonTenderPage(page));
  },
  tenderPage: async ({ page }, use) => {
    await use(new TenderPage(page));
  },
  formPaketPage: async ({ page }, use) => {
    await use(new FormPaketPage(page));
  },
  formTenderPage: async ({ page }, use) => {
    await use(new FormTenderPage(page));
  },
  ukpbjApprovalPage: async ({ page }, use) => {
    await use(new UkpbjApprovalPage(page));
  },
});

export { expect } from '@playwright/test';

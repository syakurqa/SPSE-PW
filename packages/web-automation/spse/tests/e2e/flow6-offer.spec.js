import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { env } from '../../../../common-module/config/index.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { ProviderOfferPage } from '../../pom/paket/provider-offer.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { flow6Data } from '../../fixtures/data/flow6.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test.describe('Flow 6 Dokumen Penawaran Penyedia', () => {
  test.describe.configure({ mode: 'serial' });

  test('Penyedia menyetujui Surat Penawaran', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({ page }) => {
    test.setTimeout(300000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'FLOW6_QUALIFICATION_SENT',
      'FLOW6_OFFER_LETTER_SENT',
      'FLOW6_TECHNICAL_SENT',
      'FLOW6_PRICE_SAVED',
      'FLOW6_SUBMISSION_COMPLETED',
    ]).toContain(manifest.status);

    const login = new ProviderLoginPage(page);
    const activePage = await login.login({
      username: process.env.SPSE_PROVIDER_USERNAME,
      password: process.env.SPSE_PROVIDER_PASSWORD,
    }, env.SPSE_PLATFORM.BASE_URL);
    const session = new TrainingSessionPage(activePage);
    await session.activateAndSetTime(
      flow6Data.sessionNumber,
      flow6Data.offerTime
    );
    const packages = new ProviderPackagePage(activePage);
    await packages.openAcceptedNonTenderPackageFromHome(manifest);
    const offer = new ProviderOfferPage(activePage);
    if (manifest.status === 'FLOW6_QUALIFICATION_SENT') {
      await offer.openOfferFromPackage();
      await offer.agreeOfferLetter(flow6Data.offer.validityDays);
      await activePage.goto(new URL(
        `/spse/nontender/${manifest.procurementPackageId}`,
        activePage.url()
      ).href, { waitUntil: 'domcontentloaded', });
    }
    const status = await offer.readOfferStatus();
    offer.assertOfferLetterSent(status);
    if (manifest.status === 'FLOW6_QUALIFICATION_SENT') {
      updatePackageManifest(manifestPath, {
        status: 'FLOW6_OFFER_LETTER_SENT',
        flow6OfferValidityDays: flow6Data.offer.validityDays,
        flow6OfferStatusAfterLetter: status,
        flow6OfferLetterSentAt: manifest.flow6OfferLetterSentAt
          || new Date().toISOString(),
      });
    }
  });

  test('Penyedia mengunggah seluruh Dokumen Penawaran Teknis', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({ page }) => {
    test.setTimeout(600000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'FLOW6_OFFER_LETTER_SENT',
      'FLOW6_TECHNICAL_SENT',
      'FLOW6_PRICE_SAVED',
      'FLOW6_SUBMISSION_COMPLETED',
    ]).toContain(manifest.status);

    const login = new ProviderLoginPage(page);
    const activePage = await login.login({
      username: process.env.SPSE_PROVIDER_USERNAME,
      password: process.env.SPSE_PROVIDER_PASSWORD,
    }, env.SPSE_PLATFORM.BASE_URL);
    const session = new TrainingSessionPage(activePage);
    await session.activateAndSetTime(
      flow6Data.sessionNumber,
      flow6Data.offerTime
    );
    const offer = new ProviderOfferPage(activePage);
    let uploads = manifest.flow6TechnicalUploads || [];
    if (manifest.status === 'FLOW6_OFFER_LETTER_SENT') {
      await offer.openTechnicalOffer(manifest);
      uploads = await offer.uploadAllTechnicalFiles(
        flow6Data.offer.technicalFile
      );
      if (uploads.length !== 6) {
        throw new Error(`Dokumen teknis yang tersedia ${uploads.length}, diharapkan 6.`);
      }
    }
    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded', });
    const status = await offer.readOfferStatus();
    offer.assertTechnicalOfferSent(status);
    if (manifest.status === 'FLOW6_OFFER_LETTER_SENT') {
      updatePackageManifest(manifestPath, {
        status: 'FLOW6_TECHNICAL_SENT',
        flow6TechnicalUploads: uploads,
        flow6OfferStatusAfterTechnical: status,
        flow6TechnicalSentAt: manifest.flow6TechnicalSentAt
          || new Date().toISOString(),
      });
    }
  });

  test('Penyedia mengisi harga, PPN, TKDN, dan lampiran harga', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({ page }) => {
    test.setTimeout(600000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'FLOW6_TECHNICAL_SENT',
      'FLOW6_PRICE_SAVED',
      'FLOW6_SUBMISSION_COMPLETED',
    ]).toContain(manifest.status);

    const login = new ProviderLoginPage(page);
    const activePage = await login.login({
      username: process.env.SPSE_PROVIDER_USERNAME,
      password: process.env.SPSE_PROVIDER_PASSWORD,
    }, env.SPSE_PLATFORM.BASE_URL);
    const session = new TrainingSessionPage(activePage);
    await session.activateAndSetTime(
      flow6Data.sessionNumber,
      flow6Data.offerTime
    );
    const offer = new ProviderOfferPage(activePage);
    await offer.openPriceOffer(manifest);

    let uploads = manifest.flow6PriceRequirementUploads || [];
    let price = manifest.flow6Price;
    if (manifest.status === 'FLOW6_TECHNICAL_SENT') {
      uploads = await offer.uploadPriceRequirementFiles(
        flow6Data.offer.priceRequirementFiles
      );
      price = await offer.fillAndSavePrice(flow6Data.offer);
    }

    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded', });
    const status = await offer.readOfferStatus();
    const expectedTotal = flow6Data.offer.priceBeforeVat
      * (1 + flow6Data.offer.vatPercent / 100);
    offer.assertPriceOfferSent(status, expectedTotal);
    if (manifest.status === 'FLOW6_TECHNICAL_SENT') {
      updatePackageManifest(manifestPath, {
        status: 'FLOW6_PRICE_SAVED',
        flow6PriceRequirementUploads: uploads,
        flow6Price: price,
        flow6OfferStatusAfterPrice: status,
        flow6PriceSavedAt: manifest.flow6PriceSavedAt
          || new Date().toISOString(),
      });
    }
  });

  test('Penyedia memvalidasi pengiriman akhir dan bukti elektronik', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({ page }) => {
    test.setTimeout(300000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'FLOW6_PRICE_SAVED',
      'FLOW6_SUBMISSION_COMPLETED',
    ]).toContain(manifest.status);

    const login = new ProviderLoginPage(page);
    const activePage = await login.login({
      username: process.env.SPSE_PROVIDER_USERNAME,
      password: process.env.SPSE_PROVIDER_PASSWORD,
    }, env.SPSE_PLATFORM.BASE_URL);
    const session = new TrainingSessionPage(activePage);
    await session.activateAndSetTime(
      flow6Data.sessionNumber,
      flow6Data.offerTime
    );
    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded', });
    const offer = new ProviderOfferPage(activePage);
    const expectedTotal = flow6Data.offer.priceBeforeVat
      * (1 + flow6Data.offer.vatPercent / 100);
    const evidence = await offer.collectFinalSubmissionEvidence(expectedTotal);
    updatePackageManifest(manifestPath, {
      status: 'FLOW6_SUBMISSION_COMPLETED',
      flow6FinalSubmissionEvidence: evidence,
      flow6CompletedAt: manifest.flow6CompletedAt || new Date().toISOString(),
    });
  });
});

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

test('Flow 6 mengirim semua Data Kualifikasi Penyedia', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({ page }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect([
    'FLOW5_EXPLANATION_COMPLETED',
    'FLOW6_QUALIFICATION_SENT',
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
  await packages.openNonTenderPackage(manifest);

  const offerPage = new ProviderOfferPage(activePage);
  await offerPage.openQualificationFromPackage();
  const selections = await offerPage.fillAndSendQualification(
    flow6Data.qualification
  );
  updatePackageManifest(manifestPath, {
    status: 'FLOW6_QUALIFICATION_SENT',
    flow6QualificationSelections: selections,
    flow6QualificationSentAt: new Date().toISOString(),
  });

  await activePage.goto(new URL(
    `/spse/nontender/${manifest.procurementPackageId}`,
    activePage.url()
  ).href, { waitUntil: 'domcontentloaded' });
  await expect(activePage.locator('#main')).toContainText(
    /Dokumen Kualifikasi\s+Status:\s*(?!Belum dikirim)/
  );
});

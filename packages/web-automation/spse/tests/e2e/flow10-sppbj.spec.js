import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/base.fixture.js';
import { LoginPage } from '../../pom/auth/login.page.js';
import { SppbjPage } from '../../pom/paket/sppbj.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { flow10Data } from '../../fixtures/data/flow10.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test('Flow 10 SPPBJ oleh PPK', { tag: ['@QA-T1', '@feature:flow10', '@e2e'], }, async ({ page, spseBaseUrl }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(['FLOW9_WINNER_SET', 'FLOW10_SPPBJ_COMPLETED']).toContain(manifest.status);
  expect(manifest.procurementPackageId).toBeTruthy();

  const loginPage = new LoginPage(page);
  const activePage = await loginPage.login(
    process.env.SPSE_FLOW10_PPK_USERNAME || process.env.SPSE_PPK_PP_USERNAME,
    process.env.SPSE_FLOW10_PPK_PASSWORD || process.env.SPSE_PPK_PP_PASSWORD,
    spseBaseUrl
  );
  const sessionPage = new TrainingSessionPage(activePage);
  await sessionPage.activateAndSetTime(flow10Data.sessionNumber, flow10Data.sppbjTime);
  const sppbjPage = new SppbjPage(activePage);
  await sppbjPage.open(manifest);
  await sppbjPage.fillForm(flow10Data);
  const evidence = await sppbjPage.save();

  updatePackageManifest(manifestPath, {
    status: 'FLOW10_SPPBJ_COMPLETED',
    flow10Session: flow10Data.sessionNumber,
    flow10SppbjTime: flow10Data.sppbjTime,
    flow10SppbjNumber: flow10Data.sppbjNumber,
    flow10Evidence: evidence,
    flow10CompletedAt: new Date().toISOString(),
  });
  expect(evidence.saved).toBeTruthy();
});

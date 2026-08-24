import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/base.fixture.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import { EvaluationPage } from '../../pom/paket/evaluation.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { flow8Data } from '../../fixtures/data/flow8.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test('Flow 8 Klarifikasi dan Negosiasi Teknis dan Harga oleh Pokja', { tag: ['@QA-T1', '@feature:flow8', '@e2e'], }, async ({ page, spseBaseUrl }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(['FLOW7_QUALIFICATION_PROVEN', 'FLOW8_NEGOTIATION_COMPLETED'])
    .toContain(manifest.status);
  expect(manifest.procurementPackageId).toBeTruthy();

  const loginPage = new PokjaLoginPage(page);
  const activePage = await loginPage.login({
    username: process.env.SPSE_POKJA_1_USERNAME,
    password: process.env.SPSE_POKJA_1_PASSWORD,
  }, spseBaseUrl);
  const sessionPage = new TrainingSessionPage(activePage);
  await sessionPage.activateAndSetTime(
    flow8Data.sessionNumber,
    flow8Data.negotiationTime
  );
  const packagePage = new PokjaApprovalPage(activePage);
  await packagePage.openAssignedPackage(manifest);
  const evaluationPage = new EvaluationPage(activePage);
  const evaluationUrl = await evaluationPage.open(manifest);
  await evaluationPage.openNegotiation(evaluationUrl, flow8Data.providerQuery);
  await evaluationPage.setNegotiatedItemPrice(flow8Data.finalItemPrice);
  const evidence = await evaluationPage.saveNegotiation();

  updatePackageManifest(manifestPath, {
    status: 'FLOW8_NEGOTIATION_COMPLETED',
    flow8Provider: flow8Data.providerQuery,
    flow8Session: flow8Data.sessionNumber,
    flow8NegotiationTime: flow8Data.negotiationTime,
    flow8FinalItemPrice: flow8Data.finalItemPrice,
    flow8TotalAfterTax: evidence.totalText,
    flow8NegotiationUrl: activePage.url(),
    flow8Evidence: evidence,
    flow8CompletedAt: new Date().toISOString(),
  });
  expect(evidence.bodyText).toContain('Data berhasil tersimpan');
});

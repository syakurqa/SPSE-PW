import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/base.fixture.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import { EvaluationPage } from '../../pom/paket/evaluation.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { flow9Data } from '../../fixtures/data/flow9.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test('Flow 9 Penetapan Pemenang oleh Pokja', { tag: ['@QA-T1', '@feature:flow9', '@e2e'], }, async ({ page, spseBaseUrl }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(['FLOW8_NEGOTIATION_COMPLETED', 'FLOW9_WINNER_SET'])
    .toContain(manifest.status);
  expect(manifest.procurementPackageId).toBeTruthy();

  const loginPage = new PokjaLoginPage(page);
  const activePage = await loginPage.login({
    username: process.env.SPSE_POKJA_1_USERNAME,
    password: process.env.SPSE_POKJA_1_PASSWORD,
  }, spseBaseUrl);
  const sessionPage = new TrainingSessionPage(activePage);
  await sessionPage.activateAndSetTime(
    flow9Data.sessionNumber,
    flow9Data.winnerTime
  );
  const packagePage = new PokjaApprovalPage(activePage);
  await packagePage.openAssignedPackage(manifest);
  const evaluationPage = new EvaluationPage(activePage);
  const evaluationUrl = await evaluationPage.open(manifest);
  await evaluationPage.openWinnerSelection(evaluationUrl, flow9Data.providerQuery);
  const evidence = await evaluationPage.setWinner(
    flow9Data.providerQuery,
    flow9Data.winnerOrder
  );

  updatePackageManifest(manifestPath, {
    status: 'FLOW9_WINNER_SET',
    flow9Provider: flow9Data.providerQuery,
    flow9Session: flow9Data.sessionNumber,
    flow9WinnerTime: flow9Data.winnerTime,
    flow9WinnerOrder: flow9Data.winnerOrder,
    flow9WinnerUrl: evidence.url,
    flow9Evidence: evidence,
    flow9CompletedAt: new Date().toISOString(),
  });
  expect(evidence.winnerSet).toBeTruthy();
});

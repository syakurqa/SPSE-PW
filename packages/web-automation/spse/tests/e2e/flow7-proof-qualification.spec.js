import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/base.fixture.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import { EvaluationPage } from '../../pom/paket/evaluation.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { flow7Data } from '../../fixtures/data/flow7.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test('Flow 7 Pembuktian Kualifikasi oleh Pokja', { tag: ['@QA-T1', '@feature:flow7', '@e2e'], }, async ({ page, spseBaseUrl }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect([
    'FLOW6_SUBMISSION_COMPLETED',
    'FLOW7_QUALIFICATION_PROVEN',
  ]).toContain(manifest.status);
  expect(manifest.procurementPackageId).toBeTruthy();

  const loginPage = new PokjaLoginPage(page);
  const activePage = await loginPage.login({
    username: process.env.SPSE_POKJA_1_USERNAME,
    password: process.env.SPSE_POKJA_1_PASSWORD,
  }, spseBaseUrl);
  const sessionPage = new TrainingSessionPage(activePage);
  await sessionPage.activateAndSetTime(
    flow7Data.sessionNumber,
    flow7Data.proofTime
  );
  const packagePage = new PokjaApprovalPage(activePage);
  await packagePage.openAssignedPackage(manifest);
  const evaluationPage = new EvaluationPage(activePage);
  const evaluationUrl = await evaluationPage.open(manifest);
  await evaluationPage.openParticipant(flow7Data.providerQuery);
  const invitationEvidence = await evaluationPage.sendVerificationInvitation(
    evaluationUrl,
    flow7Data.providerQuery,
    flow7Data.invitation
  );
  const evidence = await evaluationPage.confirmVmsVerification(
    evaluationUrl,
    flow7Data.providerQuery
  );

  updatePackageManifest(manifestPath, {
    status: 'FLOW7_QUALIFICATION_PROVEN',
    flow7Provider: flow7Data.providerQuery,
    flow7Session: flow7Data.sessionNumber,
    flow7ProofTime: flow7Data.proofTime,
    flow7VmsResult: flow7Data.vmsResult,
    flow7VmsVerificationUrl: evidence.vmsVerificationUrl,
    flow7ConfirmationUrl: evidence.confirmationUrl,
    flow7Invitation: invitationEvidence,
    flow7ConfirmedAt: new Date().toISOString(),
  });
  expect(manifest.procurementPackageId).toBeTruthy();
});

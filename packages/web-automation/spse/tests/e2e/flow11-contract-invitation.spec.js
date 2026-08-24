import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/base.fixture.js';
import { LoginPage } from '../../pom/auth/login.page.js';
import { SppbjPage } from '../../pom/paket/sppbj.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { flow11Data } from '../../fixtures/data/flow11.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test('Flow 11 mengirim undangan kontrak kepada Penyedia', { tag: ['@QA-T1', '@feature:flow11', '@e2e'], }, async ({ page, spseBaseUrl }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(['FLOW11_CONTRACT_DRAFT_SAVED', 'FLOW11_CONTRACT_INVITATION_SENT']).toContain(manifest.status);
  const loginPage = new LoginPage(page);
  const activePage = await loginPage.login(
    process.env.SPSE_FLOW10_PPK_USERNAME || process.env.SPSE_PPK_PP_USERNAME,
    process.env.SPSE_FLOW10_PPK_PASSWORD || process.env.SPSE_PPK_PP_PASSWORD,
    spseBaseUrl
  );
  await new TrainingSessionPage(activePage).activateAndSetTime(flow11Data.sessionNumber, flow11Data.contractTime);
  const sppbjPage = new SppbjPage(activePage);
  const evidence = await sppbjPage.sendContractInvitation(manifest, flow11Data);
  updatePackageManifest(manifestPath, {
    status: 'FLOW11_CONTRACT_INVITATION_SENT',
    flow11InvitationEvidence: evidence,
    flow11InvitationSentAt: new Date().toISOString(),
  });
  expect(evidence.sent).toBeTruthy();
});

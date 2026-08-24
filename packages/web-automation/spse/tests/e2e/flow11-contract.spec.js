import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/base.fixture.js';
import { LoginPage } from '../../pom/auth/login.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { ContractPage } from '../../pom/paket/contract.page.js';
import { flow11Data } from '../../fixtures/data/flow11.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test('Flow 11 draf Surat Perjanjian oleh PPK', { tag: ['@QA-T1', '@feature:flow11', '@e2e'], }, async ({ page, spseBaseUrl }) => {
  test.setTimeout(600000);
  const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(['FLOW10_SPPBJ_COMPLETED', 'FLOW11_CONTRACT_DRAFT_SAVED']).toContain(manifest.status);
  expect(manifest.flow10SppbjId).toBeTruthy();
  const loginPage = new LoginPage(page);
  const activePage = await loginPage.login(
    process.env.SPSE_FLOW10_PPK_USERNAME || process.env.SPSE_PPK_PP_USERNAME,
    process.env.SPSE_FLOW10_PPK_PASSWORD || process.env.SPSE_PPK_PP_PASSWORD,
    spseBaseUrl
  );
  await new TrainingSessionPage(activePage).activateAndSetTime(flow11Data.sessionNumber, flow11Data.contractTime);
  const contractPage = new ContractPage(activePage);
  await contractPage.open(manifest);
  await contractPage.fillForm(flow11Data);
  const evidence = await contractPage.save();
  updatePackageManifest(manifestPath, {
    status: 'FLOW11_CONTRACT_DRAFT_SAVED',
    flow11Session: flow11Data.sessionNumber,
    flow11ContractTime: flow11Data.contractTime,
    flow11ContractNumber: flow11Data.contractNumber,
    flow11Evidence: evidence,
    flow11CompletedAt: new Date().toISOString(),
  });
  expect(evidence.saved).toBeTruthy();
});

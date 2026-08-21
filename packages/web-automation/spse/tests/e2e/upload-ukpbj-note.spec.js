import { test, expect } from '../../fixtures/base.fixture.js';

test.describe('SPSE Upload Nota Dinas Kepala UKPBJ', () => {
  test('Kepala UKPBJ mengunggah Nota Dinas untuk paket dari manifest', {
    tag: [
      '@QA-T1',
      '@e2e'
    ]
  }, async ({
    page,
    spseBaseUrl,
    userUKPBJ,
    ukpbjApprovalData,
    ukpbjLoginPage,
    ukpbjApprovalPage,
  }) => {
    test.setTimeout(180000);
    const { manifest, documents } = ukpbjApprovalData;

    await test.step('Kepala UKPBJ login ke SPSE', async () => {
      await ukpbjLoginPage.login(
        userUKPBJ.username,
        userUKPBJ.password,
        spseBaseUrl
      );
    });

    await test.step('Membuka langsung Step 3 paket dari manifest', async () => {
      await page.goto(manifest.packageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await expect(page.locator('#main')).toContainText(
        manifest.packageName
      );
    });

    await test.step('Mengunggah Nota Dinas KUPPBJ', async () => {
      await ukpbjApprovalPage.uploadAssignmentDocument(
        documents.assignment
      );
      await expect(page.locator('#kirimEmailPokja')).toBeEnabled();
    });
  });
});

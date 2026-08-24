import { test, expect } from '../../fixtures/base.fixture.js';
import {
  PACKAGE_STATUS,
  transitionPackageManifest,
} from '../../utils/package-manifest.js';

test.describe('SPSE Persetujuan Non-Tender oleh Kepala UKPBJ', () => {
  test('Kepala UKPBJ memverifikasi paket dan mengirimkannya kepada Pokja', {
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
    test.setTimeout(300000);
    const {
      manifest,
      manifestPath,
      pokja,
      documents,
    } = ukpbjApprovalData;

    await test.step('Kepala UKPBJ login ke SPSE', async () => {
      await ukpbjLoginPage.login(
        userUKPBJ.username,
        userUKPBJ.password,
        spseBaseUrl
      );
    });

    await test.step('Memilih paket exact berdasarkan manifest Flow 1', async () => {
      await ukpbjApprovalPage.openPackage(manifest);
      await expect(page.locator('#formTambahPaket')).toContainText(
        manifest.packageName
      );
    });

    await test.step('Memeriksa dan menandai dokumen paket lengkap', async () => {
      await ukpbjApprovalPage.reviewAndMarkComplete();
    });

    await test.step('Memilih Pokja dan mengunggah dokumen penugasan', async () => {
      await ukpbjApprovalPage.selectPokjaAndUpload({
        pokja,
        documentPath: documents.assignment,
      });
    });

    await test.step('Mengirim email kepada Pokja dan menyimpan paket', async () => {
      await ukpbjApprovalPage.sendNotificationAndSave();
      await expect(page.locator('#main')).toContainText(
        'Data paket telah tersimpan'
      );
    });

    await test.step('Memperbarui status manifest Flow 2', async () => {
      const evidence = await ukpbjApprovalPage.verifyForwardedPackage({
        manifest,
        pokja,
        documentPath: documents.assignment,
      });
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.SENT_TO_UKPBJ,
        to: PACKAGE_STATUS.SENT_TO_POKJA,
        expectedRevision: manifest.revision,
        actor: 'Kepala UKPBJ',
        reason: 'Paket, Pokja, email, dan dokumen penugasan tervalidasi ulang.',
        updates: {
          approvedBy: 'Kepala UKPBJ',
          approvedAt: new Date().toISOString(),
          flow2Evidence: evidence,
        },
      });
    });
  });
});

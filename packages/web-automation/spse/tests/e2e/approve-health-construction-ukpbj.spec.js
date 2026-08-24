import { test, expect } from '../../fixtures/base.fixture.js';
import {
  PACKAGE_STATUS,
  transitionPackageManifest,
} from '../../utils/package-manifest.js';

test.describe('Flow 2 Dinas Kesehatan Pengadaan Barang Penunjukan Langsung', () => {
  test('Kepala UKPBJ meneruskan paket barang kepada Pokja', { tag: ['@QA-T1', '@feature:health-goods', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    userUKPBJ,
    ukpbjApprovalData,
    ukpbjLoginPage,
    ukpbjApprovalPage,
  }) => {
    test.setTimeout(300000);
    const {
      manifest, manifestPath, pokja, documents,
    } = ukpbjApprovalData;
    expect(manifest.flowName).toBe(
      'Flow 1 Dinas Kesehatan Pengadaan Barang Penunjukan Langsung'
    );
    expect(manifest.rupPagu).toBeGreaterThan(10_000_000_000);
    expect(manifest.hps).toBe(10_000_000_000);

    await ukpbjLoginPage.login(
      userUKPBJ.username,
      userUKPBJ.password,
      spseBaseUrl
    );
    await ukpbjApprovalPage.openPackage(manifest);
    await expect(page.locator('#formTambahPaket')).toContainText(
      manifest.packageName
    );
    await ukpbjApprovalPage.reviewAndMarkComplete();
    await ukpbjApprovalPage.selectPokjaAndUpload({
      pokja,
      documentPath: documents.assignment,
    });
    await ukpbjApprovalPage.sendNotificationAndSave();
    await expect(page.locator('#main')).toContainText(
      'Data paket telah tersimpan'
    );
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

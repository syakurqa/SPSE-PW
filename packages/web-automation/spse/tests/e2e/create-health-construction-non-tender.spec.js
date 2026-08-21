import { test, expect } from '../../fixtures/base.fixture.js';
import { writePackageManifest } from '../../utils/package-manifest.js';

test.describe('Flow 1 Dinas Kesehatan Pengadaan Barang Penunjukan Langsung', () => {
  test('PPK membuat paket barang dari RUP di atas Rp10 miliar dengan HPS Rp10 miliar', { tag: ['@QA-T1', '@feature:health-goods', '@e2e'], }, async ({
    spseBaseUrl,
    userPPK,
    nonTenderHealthConstructionData: data,
    loginPage,
    nonTenderPage,
    formPaketPage,
  }, testInfo) => {
    test.setTimeout(300000);
    await loginPage.login(userPPK.username, userPPK.password, spseBaseUrl);
    await nonTenderPage.navigateToBuatPaket(
      userPPK.username,
      userPPK.password
    );
    await nonTenderPage.selectSatkerAndMetode(data.selection);
    const selectedRup = await nonTenderPage.selectRencanaAndCreatePaket({ ...data.selection, });
    expect(selectedRup.pagu).toBeGreaterThan(data.selection.minimumPagu);

    const packageName = data.package.createName(selectedRup);
    await formPaketPage.fillNamaPaket(packageName);
    await formPaketPage.fillRincianHPSAndKBKI(data.package.kbkiItems);
    await formPaketPage.uploadDokumenLampiran(data.documents.preparation);
    const submission = await formPaketPage.selectPejabatAndSubmit(
      data.documents.notaDinasPpk
    );
    expect(submission.assignedRole).toBe('Kepala UKPBJ');
    expect(submission.status).toBe('SENT_TO_UKPBJ');

    const manifest = {
      runId: submission.packageId,
      packageId: submission.packageId,
      packageName,
      packageUrl: submission.packageUrl,
      packageType: 'Non-Tender',
      flowName: 'Flow 1 Dinas Kesehatan Pengadaan Barang Penunjukan Langsung',
      metodePemilihan: data.selection.metodeLabel,
      jenisPengadaan: data.selection.jenisPengadaanLabel,
      satker: data.selection.satkerQuery,
      rupName: selectedRup.nama,
      rupMethod: selectedRup.metodeLabel,
      rupPagu: selectedRup.pagu,
      hps: 10_000_000_000,
      assignedRole: submission.assignedRole,
      status: submission.status,
      createdAt: new Date().toISOString(),
    };
    const manifestPath = writePackageManifest(
      manifest,
      process.env.SPSE_OUTPUT_PACKAGE_MANIFEST
    );
    await testInfo.attach('package-manifest', {
      body: JSON.stringify(manifest, null, 2),
      contentType: 'application/json',
    });
    testInfo.annotations.push({
      type: 'package-manifest',
      description: manifestPath,
    });
  });
});

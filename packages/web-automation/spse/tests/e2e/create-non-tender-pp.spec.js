import { test, expect } from '../../fixtures/base.fixture.js';
import { writePackageManifest } from '../../utils/package-manifest.js';

test.describe('Flow 1 Khusus PP', () => {
  test('PPK Dinas Kesehatan membuat Pengadaan Langsung untuk Pejabat Pengadaan', { tag: ['@QA-T1', '@feature:flow-pp', '@e2e'], }, async ({
    spseBaseUrl,
    userPPKPP,
    nonTenderPPData,
    loginPage,
    nonTenderPage,
    formPaketPage,
  }, testInfo) => {
    test.setTimeout(300000);
    if (!userPPKPP.username || !userPPKPP.password) {
      throw new Error(
        'SPSE_PPK_PP_USERNAME dan SPSE_PPK_PP_PASSWORD wajib dikonfigurasi.'
      );
    }

    await loginPage.login(
      userPPKPP.username,
      userPPKPP.password,
      spseBaseUrl,
      { organization: nonTenderPPData.selection.satkerQuery }
    );
    await nonTenderPage.navigateToBuatPaket(
      userPPKPP.username,
      userPPKPP.password,
      {
        baseUrl: spseBaseUrl,
        organization: nonTenderPPData.selection.satkerQuery,
      }
    );
    await nonTenderPage.selectSatkerAndMetode(nonTenderPPData.selection);
    const selectedRup = await nonTenderPage.selectRencanaAndCreatePaket({
      rupName: nonTenderPPData.selection.rupName,
      rupIndex: nonTenderPPData.selection.rupIndex,
      metodeLabel: nonTenderPPData.selection.metodeLabel,
    });

    const packageName = nonTenderPPData.package.createName(selectedRup);
    await formPaketPage.fillNamaPaket(packageName);
    await formPaketPage.fillRincianHPSAndKBKI(
      nonTenderPPData.package.kbkiItems
    );
    await formPaketPage.uploadDokumenLampiran(
      nonTenderPPData.documents.preparation
    );
    const submission = await formPaketPage.selectPejabatAndSubmit(
      nonTenderPPData.documents.notaDinasPpk
    );

    expect(submission.assignedRole).toBe('Pejabat Pengadaan');
    expect(submission.status).toBe('SENT_TO_PROCUREMENT_OFFICER');

    const activePage = formPaketPage.getActivePage();
    await expect(activePage.getByText(
      'Data paket telah tersimpan',
      { exact: true }
    )).toBeVisible();

    const manifest = {
      runId: submission.packageId,
      packageId: submission.packageId,
      packageName,
      packageUrl: submission.packageUrl,
      packageType: 'Non-Tender',
      flowName: 'Flow 1 Khusus PP',
      metodePemilihan: nonTenderPPData.selection.metodeLabel,
      jenisPengadaan: nonTenderPPData.selection.jenisPengadaanLabel,
      satker: nonTenderPPData.selection.satkerQuery,
      rupName: selectedRup.nama,
      rupMethod: selectedRup.metodeLabel,
      rupPagu: selectedRup.pagu,
      hps: nonTenderPPData.package.kbkiItems.reduce(
        (total, item) => total + item.harga,
        0
      ),
      requiresKbki: nonTenderPPData.package.requiresKbki,
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

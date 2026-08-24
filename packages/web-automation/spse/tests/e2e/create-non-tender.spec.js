import { test, expect } from '../../fixtures/base.fixture.js';
import { writePackageManifest } from '../../utils/package-manifest.js';

test.describe('SPSE Non-Tender Automation', () => {
  test('User PPK dapat membuat paket Non-Tender baru', {
    tag: [
      '@QA-T1',
      '@e2e'
    ]
  }, async ({
    spseBaseUrl,
    userPPK,
    nonTenderData,
    loginPage,
    nonTenderPage,
    formPaketPage,
  }, testInfo) => {
    test.setTimeout(300000);
    let selectedRup;
    let packageName;
    let submission;
    const expectedRole = nonTenderData.selection.metodeLabel
      === 'Penunjukan Langsung'
      ? 'Kepala UKPBJ'
      : 'Pejabat Pengadaan';

    await test.step('PPK login ke SPSE', async () => {
      await loginPage.login(
        userPPK.username,
        userPPK.password,
        spseBaseUrl,
        { organization: nonTenderData.selection.satkerQuery }
      );
    });

    await test.step('PPK membuka form pembuatan paket Non-Tender', async () => {
      await nonTenderPage.navigateToBuatPaket(
        userPPK.username,
        userPPK.password,
        {
          baseUrl: spseBaseUrl,
          organization: nonTenderData.selection.satkerQuery,
        }
      );
      await nonTenderPage.selectSatkerAndMetode(nonTenderData.selection);
      selectedRup = await nonTenderPage.selectRencanaAndCreatePaket({
        rupName: nonTenderData.selection.rupName,
        rupIndex: nonTenderData.selection.rupIndex,
        metodeLabel: nonTenderData.selection.metodeLabel
      });
    });

    await test.step('PPK mengisi data paket dan rincian HPS/KBKI', async () => {
      packageName = nonTenderData.package.createName(selectedRup);
      await formPaketPage.fillNamaPaket(
        packageName
      );
      await formPaketPage.fillRincianHPSAndKBKI(
        nonTenderData.package.kbkiItems
      );
    });

    await test.step('PPK mengunggah seluruh dokumen persiapan', async () => {
      await formPaketPage.uploadDokumenLampiran(
        nonTenderData.documents.preparation
      );
    });

    await test.step(`PPK mengirim paket kepada ${expectedRole}`, async () => {
      submission = await formPaketPage.selectPejabatAndSubmit(
        nonTenderData.documents.notaDinasPpk
      );
      expect(submission.assignedRole).toBe(expectedRole);
      expect(submission.status).toBe(
        expectedRole === 'Kepala UKPBJ'
          ? 'SENT_TO_UKPBJ'
          : 'SENT_TO_PROCUREMENT_OFFICER'
      );
    });

    const activePage = formPaketPage.getActivePage();
    await expect(activePage.getByText('Data paket telah tersimpan', { exact: true })).toBeVisible();
    await expect(activePage.getByRole('link', {
      name: 'DAFTAR PAKET',
      exact: true
    })).toBeVisible();

    await test.step('Menyimpan manifest paket untuk Flow 2', async () => {
      const manifest = {
        runId: submission.packageId,
        packageId: submission.packageId,
        packageName,
        packageUrl: submission.packageUrl,
        packageType: 'Non-Tender',
        metodePemilihan: nonTenderData.selection.metodeLabel,
        jenisPengadaan: nonTenderData.selection.jenisPengadaanLabel,
        satker: nonTenderData.selection.satkerQuery,
        rupName: selectedRup.nama,
        rupMethod: selectedRup.metodeLabel,
        rupPagu: selectedRup.pagu,
        hps: nonTenderData.package.kbkiItems.reduce(
          (total, item) => total + item.harga,
          0
        ),
        requiresKbki: nonTenderData.package.requiresKbki,
        assignedRole: submission.assignedRole,
        status: submission.status,
        createdAt: new Date().toISOString()
      };
      const manifestPath = writePackageManifest(
        manifest,
        process.env.SPSE_OUTPUT_PACKAGE_MANIFEST
      );
      await testInfo.attach('package-manifest', {
        body: JSON.stringify(manifest, null, 2),
        contentType: 'application/json'
      });
      testInfo.annotations.push({
        type: 'package-manifest',
        description: manifestPath
      });
    });
  });
});

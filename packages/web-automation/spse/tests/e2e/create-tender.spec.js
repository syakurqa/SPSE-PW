import { test, expect } from '../../fixtures/base.fixture.js';

test.describe('SPSE Tender Automation', () => {
  test('User PPK dapat membuat paket Tender baru', {
    tag: [
      '@QA-T2',
      '@e2e'
    ]
  }, async ({
    spseBaseUrl,
    userPPK,
    tenderData,
    loginPage,
    tenderPage,
    formTenderPage,
  }) => {
    const packageCount = Number(
      process.env.SPSE_TENDER_PACKAGE_COUNT || 1
    );
    test.setTimeout(300000 * packageCount);

    await test.step('PPK login ke SPSE', async () => {
      await loginPage.login(
        userPPK.username,
        userPPK.password,
        spseBaseUrl
      );
    });

    for (let packageNumber = 1;
      packageNumber <= packageCount;
      packageNumber++) {
      let selectedRup;

      await test.step(`Paket ${packageNumber}: memilih RUP Tender`, async () => {
        await tenderPage.navigateToBuatPaket();
        await tenderPage.selectSatkerAndMetode(tenderData.selection);
        selectedRup = await tenderPage.selectRencanaAndCreatePaket({
          rupIndex: tenderData.selection.rupIndex,
          metodeLabel: tenderData.selection.metodeLabel,
        });
      });

      await test.step(`Paket ${packageNumber}: mengisi HPS/KBKI`, async () => {
        await formTenderPage.fillNamaPaket(
          tenderData.package.createName(selectedRup)
        );
        await formTenderPage.fillRincianHPSAndKBKI(
          tenderData.package.kbkiItems
        );
      });

      await test.step(`Paket ${packageNumber}: mengunggah dokumen`, async () => {
        await formTenderPage.uploadDokumenLampiran(
          tenderData.documents.preparation
        );
      });

      await test.step(`Paket ${packageNumber}: menyimpan paket`, async () => {
        await formTenderPage.selectKepalaUkpbjAndSubmit(
          tenderData.documents.notaDinasPpk
        );

        const activePage = formTenderPage.getActivePage();
        await expect(activePage.getByText(
          /Data Paket berhasil tersimpan/i
        )).toBeVisible();
        await expect(activePage.getByRole('link', {
          name: 'DAFTAR PAKET',
          exact: true
        })).toBeVisible();
      });
    }
  });
});

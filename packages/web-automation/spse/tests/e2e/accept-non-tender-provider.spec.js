import { test, expect } from '../../fixtures/workflow.fixture.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import {
  PACKAGE_STATUS,
  transitionPackageManifest,
} from '../../utils/package-manifest.js';

test.describe('Flow 4 penerimaan paket Non-Tender oleh Penyedia', () => {
  test('Penyedia menyetujui Pakta Integritas dan menerima paket', { tag: ['@QA-T1', '@feature:flow4', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    providerActor,
  }) => {
    test.setTimeout(300000);
    const { manifest, manifestPath } = packageManifest;
    expect([
      PACKAGE_STATUS.POKJA_APPROVED,
      PACKAGE_STATUS.ACCEPTED_BY_PROVIDER,
    ]).toContain(manifest.status);

    const loginPage = new ProviderLoginPage(page);
    const activePage = await loginPage.login(
      providerActor,
      spseBaseUrl
    );
    const packagePage = new ProviderPackagePage(activePage);
    if (manifest.status === PACKAGE_STATUS.POKJA_APPROVED) {
      await packagePage.openAvailableNonTenderPackage(manifest);
      await packagePage.acceptPackage();
    }
    await packagePage.verifyPackageOnHome(manifest);

    transitionPackageManifest(manifestPath, {
      from: [
        PACKAGE_STATUS.POKJA_APPROVED,
        PACKAGE_STATUS.ACCEPTED_BY_PROVIDER,
      ],
      to: PACKAGE_STATUS.ACCEPTED_BY_PROVIDER,
      expectedRevision: manifest.revision,
      actor: providerActor.displayName,
      reason: 'Penyedia menerima paket dan validasi Beranda berhasil.',
      updates: {
        acceptedByProvider: providerActor.displayName,
        acceptedByProviderAt: manifest.acceptedByProviderAt
        || new Date().toISOString(),
        providerHomeValidatedAt: new Date().toISOString(),
      },
    });
  });
});

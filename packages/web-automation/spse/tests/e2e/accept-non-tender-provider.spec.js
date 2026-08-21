import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { env } from '../../../../common-module/config/index.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test.describe('Flow 4 penerimaan paket Non-Tender oleh Penyedia', () => {
  test('Angsae Baru menyetujui Pakta Integritas dan menerima paket', { tag: ['@QA-T1', '@feature:flow4', '@e2e'], }, async ({ page }) => {
    test.setTimeout(300000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    if (!process.env.SPSE_PACKAGE_MANIFEST || !fs.existsSync(manifestPath)) {
      throw new Error('SPSE_PACKAGE_MANIFEST Flow 4 tidak ditemukan.');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'POKJA_APPROVED',
      'ACCEPTED_BY_PROVIDER',
    ]).toContain(manifest.status);

    const credentials = {
      username: process.env.SPSE_PROVIDER_USERNAME,
      password: process.env.SPSE_PROVIDER_PASSWORD,
    };
    const loginPage = new ProviderLoginPage(page);
    const activePage = await loginPage.login(
      credentials,
      env.SPSE_PLATFORM.BASE_URL
    );
    const packagePage = new ProviderPackagePage(activePage);
    if (manifest.status === 'POKJA_APPROVED') {
      await packagePage.openAvailableNonTenderPackage(manifest);
      await packagePage.acceptPackage();
    }
    await packagePage.verifyPackageOnHome(manifest);

    updatePackageManifest(manifestPath, {
      status: 'ACCEPTED_BY_PROVIDER',
      acceptedByProvider: 'ANGSAE BARU',
      acceptedByProviderAt: manifest.acceptedByProviderAt
        || new Date().toISOString(),
      providerHomeValidatedAt: new Date().toISOString(),
    });
  });
});

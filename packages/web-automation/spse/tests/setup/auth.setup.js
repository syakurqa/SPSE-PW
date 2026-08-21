import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../../../common-module/config/index.js';
import { LoginPage } from '../../pom/auth/login.page.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.resolve(__dirname, '../../.auth/ppk.json');

setup('authenticate PPK for focused SPSE tests', async ({ page }) => {
  const platform = env.SPSE_PLATFORM;
  if (!platform?.BASE_URL || !platform?.USER?.PPK) {
    throw new Error(
      'SPSE_PLATFORM.BASE_URL dan SPSE_PLATFORM.USER.PPK wajib tersedia di konfigurasi environment.'
    );
  }

  const loginPage = new LoginPage(page);
  await loginPage.login(
    platform.USER.PPK.username,
    platform.USER.PPK.password,
    platform.BASE_URL
  );

  await expect(page.getByRole('link', { name: /DAFTAR PAKET/i }).first()).toBeVisible();

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});

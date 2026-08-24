import fs from 'fs';
import path from 'path';
import { FormPaketPage } from './form-paket.page.js';
import { captureGuideStep } from '../../utils/guide-capture.js';

export class UkpbjApprovalPage extends FormPaketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
  }

  async selectOptionMatching(select, pattern, label) {
    const match = await select.locator('option').evaluateAll(
      (options, source) => {
        const expression = new RegExp(source, 'i');
        const option = options.find((candidate) => expression.test(
          (candidate.textContent || '').trim()
        ));
        return option ? {
          value: option.value,
          text: (option.textContent || '').trim(),
        } : null;
      },
      pattern.source
    );
    if (!match) {
      throw new Error(`Pilihan ${label} tidak tersedia.`);
    }
    await select.selectOption(match.value);
    const selected = (await select.locator('option:checked').textContent())
      ?.trim();
    if (selected !== match.text) {
      throw new Error(
        `${label} gagal dipilih. Diharapkan "${match.text}", aktual "${selected}".`
      );
    }
    return match;
  }

  async handleInaprocSsoIfNeeded() {
    const page = this.getActivePage();
    for (let i = 0; i < 15; i++) {
      const url = page.url();
      if (url.includes('/spse/paketnontender/') && (url.includes('edit') || url.includes('form') || url.includes('dokumen') || url.includes('tambah'))) {
        return;
      }

      if (url.includes('accounts.inaproc.id') || url.includes('register-spa') || url.includes('/u/login')) {
        const email = process.env.SPSE_UKPBJ_USERNAME;
        const password = process.env.SPSE_UKPBJ_PASSWORD;
        if (!email || !password) {
          throw new Error('SPSE UKPBJ credentials are required through environment variables.');
        }

        const emailInput = page.locator('input[name="email"], input[name="username"], input[placeholder*="namapengguna" i], input[type="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await emailInput.fill(email);
          await emailInput.dispatchEvent('input').catch(() => null);
          await emailInput.dispatchEvent('change').catch(() => null);
          await page.waitForTimeout(1000);
          const submitBtn = page.locator('#login-btn, button[type="submit"], button:has-text("Masuk"), button:has-text("Lanjut")').first();
          await submitBtn.click({ force: true });
          await page.waitForTimeout(2500);
        }

        const passInput = page.locator('input[name="password"], input[type="password"]').first();
        if (await passInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await passInput.fill(password);
          await passInput.dispatchEvent('input').catch(() => null);
          await passInput.dispatchEvent('change').catch(() => null);
          await page.waitForTimeout(500);
          const passSubmit = page.locator('button[type="submit"], button:has-text("Lanjut")').first();
          await passSubmit.click({ force: true });
          await page.waitForTimeout(2500);
        }

        const bypassBtn = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i });
        if (await bypassBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bypassBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }

      if (url.includes('account.eproc.dev')) {
        const accessLink = page.getByRole('link', { name: 'Manajemen Akses' });
        if (await accessLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await accessLink.click();
          await page.waitForTimeout(1000);
        }

        // 1. If modal dialog is open, click Pilih on SPSE Staging
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
          const spseModalBtn = modal.locator('tr').filter({ hasText: /SPSE Staging/i }).locator('button').first();
          if (await spseModalBtn.isVisible().catch(() => false)) {
            await spseModalBtn.click();
            await page.waitForTimeout(1500);
          }
        } else {
          const cirebonRow = page.locator('tr').filter({ hasText: /KOTA CIREBON/i }).first();
          if (!await cirebonRow.isVisible({ timeout: 2000 }).catch(() => false)) {
            const dropdown = page.locator('input[placeholder*="Pilih"], [role="combobox"]').first();
            if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
              await dropdown.click();
              await page.waitForTimeout(1000);
              const spseModalBtn = page.locator('[role="dialog"]').locator('tr').filter({ hasText: /SPSE Staging/i }).locator('button').first();
              if (await spseModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await spseModalBtn.click();
                await page.waitForTimeout(1500);
              }
            }
          }
        }

        // 2. Click KOTA CIREBON row or Aktif button
        const cirebonRow = page.locator('tr').filter({ hasText: /KOTA CIREBON/i }).first();
        if (await cirebonRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          const aktifBtn = cirebonRow.locator('button, a, span').filter({ hasText: /Aktif|Pilih|Masuk/i }).first();
          if (await aktifBtn.isVisible().catch(() => false)) {
            await aktifBtn.click();
          } else {
            await cirebonRow.click();
          }
          await page.waitForTimeout(3000);
        }
      }

      const bypassKey = page.getByRole('button', { name: /Lanjutkan tanpa Security Key/i });
      if (await bypassKey.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bypassKey.click({ force: true });
        await page.waitForTimeout(2000);
      }

      const roleBtn = page.locator('button[id^="login-pesona-"]').filter({ hasText: /Kepala UKPBJ/i }).or(page.locator('#login-pesona-4-btn')).first();
      if (await roleBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await roleBtn.click({ force: true });
        await page.waitForTimeout(3000);
      }

      await page.waitForTimeout(1000);
    }
  }

  async openPackage(manifest) {
    const nonTenderLink = this.page.getByRole('link', {
      name: 'Non Tender',
      exact: true
    });
    await nonTenderLink.waitFor({
      state: 'visible',
      timeout: 30000
    });
    await captureGuideStep(this.page, {
      instruction: 'Klik menu Non Tender pada akun Kepala UKPBJ',
      target: nonTenderLink,
      expected: 'Daftar paket yang perlu diverifikasi ditampilkan.'
    });
    await nonTenderLink.click();
    await this.page.waitForTimeout(1500);

    const packageLinkById = this.page.locator(
      `a[href*="/paketnontender/${manifest.packageId}"]`
    ).filter({ hasText: manifest.packageName }).first();
    const exactPackageLink = this.page.getByRole('link', {
      name: manifest.packageName,
      exact: true
    });
    const packageLink = exactPackageLink.or(packageLinkById).first();
    await packageLink.waitFor({
      state: 'visible',
      timeout: 30000
    });

    const actualName = (await packageLink.textContent())
      ?.replace(/\s+/g, ' ').trim();
    if (!actualName?.includes(manifest.packageName)) {
      throw new Error(
        `Nama paket tidak sama dengan manifest. Aktual: "${actualName}".`
      );
    }
    await captureGuideStep(this.page, {
      instruction: `Klik paket exact ${manifest.packageName}`,
      target: packageLink,
      expected: 'Detail paket Flow 1 terbuka.'
    });
    await packageLink.click();
    await this.page.waitForTimeout(2000);

    // Re-auth if intercepted by Pomerium/INAPROC
    await this.handleInaprocSsoIfNeeded();

    const form = this.page.locator('#formTambahPaket, #formPaket, #main');
    await form.first().waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async reviewAndMarkComplete() {
    const page = this.getActivePage();
    const form = page.locator('#formTambahPaket, #formPaket, #main').first();
    const nextButton = () => page.locator(
      'button:has-text("Selanjutnya"), a:has-text("Selanjutnya"), input[value*="Selanjutnya" i]'
    ).first();

    if (await nextButton().isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextButton().click();
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    }
    const statusSelect = page.locator(
      '#statusPersetujuan, select[name*="status" i]'
    ).first();
    if (await statusSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.selectOptionMatching(
        statusSelect,
        /Lengkap|Setuju/i,
        'status review lengkap'
      );
    }

    const checkAll = page.locator(
      'input[type="checkbox"]#checkAll, input[type="checkbox"][name*="all" i]'
    ).first();
    if (await checkAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkAll.check();
    }

    const checkboxes = form.locator(
      'input[type="checkbox"]:not([disabled])'
    );
    const count = await checkboxes.count();
    for (let index = 0; index < count; index++) {
      const checkbox = checkboxes.nth(index);
      if (!await checkbox.isChecked()) {
        await checkbox.check();
      }
      if (!await checkbox.isChecked()) {
        throw new Error(`Checklist review ke-${index + 1} gagal dipilih.`);
      }
    }

    const saveReviewBtn = page.locator(
      'button:has-text("Simpan"), input[value*="Simpan" i]'
    ).first();
    if (await saveReviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveReviewBtn.click();
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    }

    const completeButton = page.getByRole('button', { name: /Lengkap/, }).first();
    if (await completeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await completeButton.click();
      const confirmButton = page.getByRole('button', {
        name: 'OK',
        exact: true,
      });
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    }

    if (await nextButton().isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextButton().click();
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    }

    const step3Controls = page.locator(
      '#pokjaId, select[name*="pokja" i], select[id*="pokja" i], input[type="file"]'
    );
    if (await step3Controls.count() === 0) {
      const packageId = page.url().match(/paketnontender\/([^/?]+)/)?.[1];
      if (!packageId) {
        throw new Error(`ID paket Flow 2 tidak ditemukan: ${page.url()}`);
      }
      await page.goto(new URL(
        `/spse/paketnontender/${packageId}/edit?step=3`,
        page.url()
      ).href, { waitUntil: 'domcontentloaded' });
    }
  }

  async selectPokjaAndUpload({ pokja, documentPath }) {
    const page = this.getActivePage();
    let pokjaSelected = false;
    const choosePokjaButton = page.getByRole('button', { name: /Pilih Pokja Pemilihan/, }).or(page.getByRole('link', { name: /Pilih Pokja Pemilihan/, })).first();
    if (await choosePokjaButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await choosePokjaButton.click();
      const rows = page.locator('table tbody tr').filter({
        has: page.getByRole('link', {
          name: 'Pilih',
          exact: true
        }),
      });
      const targetRow = pokja?.name
        ? rows.filter({ hasText: pokja.name }).first()
        : rows.nth(Math.max(0, Number(pokja?.index || 1) - 1));
      await targetRow.waitFor({
        state: 'visible',
        timeout: 15000
      });
      await targetRow.getByRole('link', {
        name: 'Pilih',
        exact: true,
      }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      pokjaSelected = true;
    }
    const pokjaSelect = page.locator(
      '#pokjaId, select[name*="pokja" i], select[id*="pokja" i]'
    ).first();
    if (await pokjaSelect.isVisible({ timeout: 10000 }).catch(() => false)) {
      if (pokja?.name) {
        await this.selectOptionMatching(
          pokjaSelect,
          new RegExp(pokja.name, 'i'),
          `Pokja ${pokja.name}`
        );
      } else {
        const options = pokjaSelect.locator('option:not([value=""])');
        const optionCount = await options.count();
        const index = Math.max(0, Number(pokja?.index || 1) - 1);
        if (index >= optionCount) {
          throw new Error(
            `Urutan Pokja ${index + 1} tidak tersedia; jumlah ${optionCount}.`
          );
        }
        const value = await options.nth(index).getAttribute('value');
        await pokjaSelect.selectOption(value);
      }
      pokjaSelected = true;
    }

    if (!pokjaSelected) {
      throw new Error('Kontrol pemilihan Pokja tidak ditemukan atau belum tersimpan.');
    }
    if (!documentPath || !fs.existsSync(documentPath)) {
      throw new Error(`Dokumen penugasan Pokja tidak ditemukan: ${documentPath}`);
    }
    {
      const packageId = page.url().match(/paketnontender\/([^/?]+)/)?.[1];
      if (!packageId) {
        throw new Error(`ID paket Flow 2 tidak ditemukan: ${page.url()}`);
      }
      const uploadedFile = page.locator('#files').getByText(
        path.basename(documentPath),
        { exact: false }
      );
      if (!await uploadedFile.isVisible().catch(() => false)) {
        await this.uploadSignedFile({
          page,
          packageId,
          absPath: documentPath,
          saveUrl: `${new URL(page.url()).origin}/spse/paketnontender/${packageId}/uploadAttachment`,
          extraForm: { step: 3 },
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      await page.locator('#files').getByText(
        path.basename(documentPath),
        { exact: false }
      ).waitFor({
        state: 'visible',
        timeout: 30000
      });
    }
  }

  async sendNotificationAndSave() {
    const page = this.getActivePage();
    const emailAlreadySent = page.getByText(
      /Sudah dikirim/i,
      { exact: false }
    ).first();
    if (!await emailAlreadySent.isVisible().catch(() => false)) {
      const sendEmailButton = page.locator(
        '#kirimEmailPokja:visible, button:visible'
      ).filter({ hasText: /Kirim Email/i }).first();
      await sendEmailButton.waitFor({
        state: 'visible',
        timeout: 30000
      });
      await sendEmailButton.click();
      const sendConfirmation = page.getByRole('button', { name: /^(OK|Ya|Kirim)$/, }).first();
      if (await sendConfirmation.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendConfirmation.click();
      }
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      await page.getByText(/Sudah dikirim/i, { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 30000
      });
    }

    const simpanBtn = page.getByRole('button', { name: /Simpan$/, }).first();
    await simpanBtn.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await simpanBtn.waitFor({
      state: 'attached',
      timeout: 15000
    });
    if (!await simpanBtn.isEnabled({ timeout: 30000 })) {
      throw new Error('Tombol Simpan Flow 2 masih disabled.');
    }
    await simpanBtn.click();
    const confirmButton = page.getByRole('button', { name: /^(OK|Ya|Simpan)$/, }).first();
    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    await page.getByText(
      'Data paket telah tersimpan',
      { exact: true }
    ).waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async verifyForwardedPackage({
    manifest, pokja, documentPath
  }) {
    const page = this.getActivePage();
    await page.goto(new URL(
      `/spse/paketnontender/${manifest.packageId}/edit?step=3`,
      page.url()
    ).href, { waitUntil: 'domcontentloaded' });

    const main = page.locator('#main, #formTambahPaket').first();
    await main.waitFor({
      state: 'visible',
      timeout: 30000
    });
    const mainText = (await main.innerText()).replace(/\s+/g, ' ');
    if (!/Sudah dikirim/i.test(mainText)) {
      throw new Error('Status email ke Pokja belum persisten setelah reload.');
    }
    const fileName = path.basename(documentPath);
    if (!mainText.includes(fileName)) {
      throw new Error(
        `Dokumen penugasan ${fileName} tidak ditemukan setelah reload.`
      );
    }
    if (pokja?.name && !mainText.includes(pokja.name)) {
      throw new Error(
        `Pokja "${pokja.name}" tidak ditemukan setelah reload.`
      );
    }
    return {
      emailStatus: 'SENT',
      document: fileName,
      pokja: pokja?.name || `urutan ${pokja?.index || 1}`,
    };
  }
}

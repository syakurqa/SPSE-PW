import { captureGuideStep } from '../../utils/guide-capture.js';

export class ProviderOfferPage {
  constructor(page) {
    this.page = page;
  }

  async openQualificationFromPackage() {
    const sendDataLink = this.page.getByRole('link', { name: /^(Kirim Data|Ubah Data)$/, });
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim Data/Ubah Data pada Dokumen Kualifikasi',
      target: sendDataLink,
      expected: 'Wizard Data Kualifikasi terbuka.',
    });
    await sendDataLink.click();
    await this.page.getByText('Kirim Data Kualifikasi', { exact: true, }).first().waitFor({
      state: 'visible',
      timeout: 30000
    });
  }

  async selectConfiguredData(scopeSelector, inputName, selection, subTabSelector) {
    const sectionTab = this.page.locator(`a[href="${scopeSelector}"]`).first();
    if (await sectionTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sectionTab.click();
    }
    if (subTabSelector) {
      await this.page.locator(`a[href="${subTabSelector}"]`).click();
    }
    const scope = this.page.locator(scopeSelector);
    const inputs = scope.locator(
      `input[type="checkbox"][name="${inputName}"]:visible`
    );
    const count = await inputs.count();
    const indexes = selection === 'all'
      ? Array.from({ length: count }, (_, index) => index)
      : selection;
    if (!Array.isArray(indexes)) {
      throw new Error(
        `Konfigurasi ${scopeSelector} harus 'all' atau array indeks.`
      );
    }
    for (const index of indexes) {
      if (index < 0 || index >= count) {
        throw new Error(
          `Indeks ${index} di ${scopeSelector} tidak tersedia; jumlah data ${count}.`
        );
      }
      const input = inputs.nth(index);
      if (!await input.isChecked()) {
        await input.check({ force: true });
      }
    }
    return indexes.length;
  }

  async fillAndSendQualification(qualification) {
    const selections = {
      businessPermits: await this.selectConfiguredData(
        '#ijin', 'ijin', qualification.businessPermits,
        '#tabIzinUsahaLainnyaPl'
      ),
      personnel: await this.selectConfiguredData(
        '#staf', 'staf', qualification.personnel
      ),
      experience: await this.selectConfiguredData(
        '#pengalaman', 'pengalaman', qualification.experience
      ),
      ongoingWork: await this.selectConfiguredData(
        '#pekerjaan', 'pengalaman', qualification.ongoingWork
      ),
      equipment: await this.selectConfiguredData(
        '#peralatan', 'alat', qualification.equipment
      ),
    };

    const taxTab = this.page.getByRole('tab', {
      name: 'Pajak',
      exact: true,
    });
    await taxTab.click();
    const checkKswp = this.page.getByRole('link', {
      name: 'Cek Valid KSWP',
      exact: true,
    });
    if (await checkKswp.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkKswp.click();
      await this.page.waitForTimeout(1000);
    }

    const otherTab = this.page.getByRole('tab', {
      name: 'Persyaratan Lainnya',
      exact: true,
    });
    await otherTab.click();
    await this.page.locator('#fileupload').setInputFiles(
      qualification.otherRequirementFile
    );
    await this.page.waitForTimeout(1500);

    const sendButton = this.page.locator('#btnKirim');
    await captureGuideStep(this.page, {
      instruction: 'Klik Kirim Data Kualifikasi',
      target: sendButton,
      expected: 'Konfirmasi pengiriman Data Kualifikasi ditampilkan.',
    });
    await sendButton.click();
    const agreement = this.page.locator('#check_setuju');
    await agreement.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await agreement.check();
    await this.page.locator('#submit-kualifikasi').click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return selections;
  }
}

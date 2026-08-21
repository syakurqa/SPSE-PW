import fs from 'fs';
import path from 'path';
import { captureGuideStep } from '../../utils/guide-capture.js';

export class FormPaketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.activePage = null;
  }

  getActivePage() {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }
    const pages = this.page.context().pages().filter((page) => !page.isClosed());
    const editPage = pages.filter((page) =>
      /\/spse\/paketnontender\/[^/?]+\/edit(?:\?|$)/.test(page.url())
      || page.url().includes('paketplctr')
    ).at(-1);
    this.activePage = editPage || (
      pages.length > 0 ? pages[pages.length - 1] : this.page
    );
    return this.activePage;
  }

  async fillNamaPaket(namaPaket) {
    const page = this.getActivePage();
    await page.bringToFront().catch(() => null);

    const namaPaketInput = page.locator(
      'textarea[name="paket.pkt_nama"], input[name="paket.pkt_nama"], #paket_pkt_nama, [name*="pkt_nama"]'
    ).first();
    const selanjutnyaButton = page.locator('button:has-text("Selanjutnya"), a:has-text("Selanjutnya"), input[value*="Selanjutnya" i]').first();

    if (await namaPaketInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      this.activePage = page;
      await captureGuideStep(page, {
        instruction: 'Isi Nama Paket Non Tender',
        action: 'Isi',
        target: namaPaketInput,
        expected: 'Nama paket tampil pada draft.'
      });
      await namaPaketInput.clear().catch(() => null);
      await namaPaketInput.fill(namaPaket);
      await page.waitForTimeout(1000);

      if (await selanjutnyaButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await selanjutnyaButton.scrollIntoViewIfNeeded().catch(() => null);
        await captureGuideStep(page, {
          instruction: 'Klik Selanjutnya menuju Dokumen Persiapan',
          target: selanjutnyaButton,
          expected: 'Step 2 draft paket terbuka.'
        });
        await selanjutnyaButton.click();
        await page.waitForTimeout(2000); // Tunggu transisi ke step selanjutnya (step 2)
      }
      return;
    }
    // Fallback: pindai seluruh tab context jika halaman form dimuat lambat
    for (const p of this.page.context().pages()) {
      const inputInP = p.locator(
        'textarea[name="paket.pkt_nama"], input[name="paket.pkt_nama"], [name*="pkt_nama"]'
      ).first();
      if (await inputInP.isVisible({ timeout: 3000 }).catch(() => false)) {
        this.activePage = p;
        await p.bringToFront().catch(() => null);
        await inputInP.clear().catch(() => null);
        await inputInP.fill(namaPaket);
        await p.waitForTimeout(1000);

        const btn = p.locator('button:has-text("Selanjutnya"), a:has-text("Selanjutnya"), input[value*="Selanjutnya" i]').first();
        if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await btn.scrollIntoViewIfNeeded().catch(() => null);
          await btn.click();
          await p.waitForTimeout(2000);
        }
        return;
      }
    }

    throw new Error(
      `Form nama paket tidak ditemukan. Tab aktif: ${this.page.context().pages().map((candidate) => candidate.url()).join(' | ')}`
    );
  }

  async fillRincianHPS({
    namaBarang, satuan, hargaSatuan, kuantitas
  }) {
    const page = this.getActivePage();
    const rincianHpsLink = page.getByRole('link', { name: 'Rincian HPS' });

    await rincianHpsLink.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await captureGuideStep(page, {
      instruction: 'Klik Rincian HPS untuk mengisi item dan KBKI',
      target: rincianHpsLink,
      expected: 'Tabel rincian HPS terbuka.'
    });
    await rincianHpsLink.click();

    await page.getByRole('cell').first().click();
    await page.locator('#tbl-rincian').getByRole('textbox').fill(namaBarang);
    await page.getByRole('cell').nth(1).dblclick();
    await page.locator('#tbl-rincian').getByRole('textbox').fill(satuan);
    await page.getByRole('cell', { name: '0,00' }).first().dblclick();
    await page.locator('#tbl-rincian').getByRole('textbox').fill(hargaSatuan);
    await page.getByRole('cell', { name: '1,00' }).first().dblclick();
    await page.locator('#tbl-rincian').getByRole('textbox').fill(kuantitas);
  }

  async fillRincianHPSAndKBKI(items = []) {
    const page = this.getActivePage();
    await page.bringToFront().catch(() => null);

    // 1. Tunggu dan klik link "Rincian HPS"
    const rincianHpsLink = page.getByRole('link', { name: 'Rincian HPS' });
    await rincianHpsLink.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await rincianHpsLink.click();
    const firstHpsRow = page.locator('#tbl-rincian tbody tr').first();
    await firstHpsRow.waitFor({
      state: 'visible',
      timeout: 60000
    });

    // Helper fill satu sel Handsontable: dblclick → fill textbox (tanpa Tab/Enter)
    // Commit terjadi saat sel berikutnya di-dblclick (blur event)
    const fillCell = async (rowLocator, colIndex, value, required = true) => {
      if (value === undefined || value === null) return;
      const cell = rowLocator.locator('td').nth(colIndex);
      await cell.scrollIntoViewIfNeeded().catch(() => null);
      await cell.dblclick();
      await page.waitForTimeout(400);
      // Cari textbox yang aktif — dalam table custom ini textbox muncul di dalam #tbl-rincian
      const textbox = page.locator(
        'textarea.handsontableInput:visible, #tbl-rincian textarea:visible, #tbl-rincian input[type="text"]:visible'
      ).last();
      const editorVisible = await textbox.waitFor({
        state: 'visible',
        timeout: 5000
      }).then(() => true).catch(() => false);
      if (!editorVisible) {
        if (required) {
          throw new Error(`Editor HPS kolom ${colIndex} tidak terbuka.`);
        }
        return;
      }
      await textbox.fill(String(value));
      await page.waitForTimeout(200);
    };

    // 2. Loop untuk setiap item baris
    // Kolom index (0-based dari <td>, karena "No" kolom adalah <th>):
    // 0=JenisBarang, 1=Satuan, 2=Vol, 3=Harga/Biaya, 4=Pajak, 5=Total, 6=Keterangan, 7=KunciBaris, 8=KBKI, 9=Aksi
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = page.locator('#tbl-rincian tbody tr').nth(i);
      await row.waitFor({
        state: 'visible',
        timeout: 60000
      });

      // Isi Jenis Barang/Jasa (td.nth(0))
      await fillCell(row, 0, item.jenisBarang);
      // Isi Satuan (td.nth(1)) — dblclick ini sekaligus commit Jenis Barang
      await fillCell(row, 1, item.satuan);
      // Isi Harga/Biaya (td.nth(3)) — dblclick ini sekaligus commit Satuan
      await fillCell(row, 3, item.harga);
      // Isi Keterangan (td.nth(6)) — dblclick ini sekaligus commit Harga
      await fillCell(row, 6, item.keterangan, false);
      // Tekan Escape untuk tutup editor keterangan lalu tunggu stabilize
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // === KLIK TOMBOL KBKI PADA BARIS INI ===
      await row.scrollIntoViewIfNeeded().catch(() => null);
      // Tunggu modal dari iterasi sebelumnya benar-benar tertutup
      await page.locator('.modal.show, .modal[style*="display: block"]').waitFor({
        state: 'hidden',
        timeout: 5000
      }).catch(() => null);
      const kbkiBtn = row.locator('button:has-text("KBKI"), a:has-text("KBKI")').first();
      await kbkiBtn.waitFor({
        state: 'visible',
        timeout: 12000
      });
      await captureGuideStep(page, {
        instruction: `Klik KBKI pada item ${i + 1}`,
        target: kbkiBtn,
        expected: 'Modal pemilihan KBKI terbuka.'
      });
      await kbkiBtn.click();
      await page.waitForTimeout(1200);

      // === MODAL KBKI: Pilih Deskripsi → Cari → Centang → Tambah ===
      const kbkiModal = page.locator('.modal.show, [role="dialog"]:visible')
        .last();
      const nativeDescriptionSelect = kbkiModal.locator('select').filter({ has: page.locator(`option:has-text("${item.selectText}")`) }).first();
      if (await nativeDescriptionSelect.count() > 0) {
        await nativeDescriptionSelect.selectOption(
          { label: item.selectText },
          { force: true }
        );
        await nativeDescriptionSelect.dispatchEvent('change');
        const selectedDescription = (await nativeDescriptionSelect
          .locator('option:checked').textContent())?.trim();
        if (selectedDescription !== item.selectText) {
          throw new Error(
            `Deskripsi KBKI gagal dipilih. Diharapkan "${item.selectText}", aktual "${selectedDescription}".`
          );
        }
      } else {
        await page.getByRole('combobox', { name: 'Pilih Deskripsi' }).click();
        const searchBox = page.getByRole('combobox', { name: 'Search' });
        await searchBox.fill(item.query);
        const optionLink = page.locator(
          `.dropdown-menu.show a:has-text("${item.selectText}")`
        ).first();
        await optionLink.waitFor({
          state: 'visible',
          timeout: 5000
        });
        await optionLink.click();
      }
      await page.waitForTimeout(500);

      const cariKbkiButton = page.getByRole('button', { name: 'Cari KBKI' });
      await captureGuideStep(page, {
        instruction: 'Klik Cari KBKI',
        target: cariKbkiButton,
        expected: 'Daftar kode KBKI ditampilkan.'
      });
      await cariKbkiButton.click();
      // Respons katalog KBKI kadang membutuhkan lebih dari 10 detik. Tunggu
      // indikator DataTables selesai agar kondisi loading tidak dianggap
      // sebagai hasil pencarian kosong.
      const kbkiProcessing = page.getByText(
        /Sedang Proses|Processing/i
      ).first();
      if (await kbkiProcessing.isVisible({ timeout: 3000 }).catch(() => false)) {
        await kbkiProcessing.waitFor({
          state: 'hidden',
          timeout: 60000
        });
      }

      const radio = page.getByRole('radio').first();
      if (!await radio.isVisible({ timeout: 60000 }).catch(() => false)) {
        const noData = await page.getByText('Tidak ada data', { exact: true }).isVisible().catch(() => false);
        throw new Error(
          `KBKI tidak ditemukan untuk "${item.selectText}"${noData ? ' (hasil pencarian kosong)' : ''}.`
        );
      }
      await captureGuideStep(page, {
        instruction: `Pilih kode KBKI untuk item ${i + 1}`,
        action: 'Pilih',
        target: radio,
        expected: 'Kode KBKI ditandai.'
      });
      await radio.check();
      await page.waitForTimeout(400);

      await page.getByRole('button', { name: 'Tambah' }).click();
      await page.waitForTimeout(1500);

      const savedRowText = (await row.innerText()).replace(/\s+/g, ' ');
      const expectedPrice = Number(item.harga).toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (!savedRowText.includes(expectedPrice)) {
        throw new Error(
          `Nilai HPS belum ter-commit. Diharapkan ${expectedPrice}, baris aktual: ${savedRowText}`
        );
      }
    }

    // 3. Klik tombol Simpan
    const saveHpsButton = page.getByRole('button', { name: ' Simpan' });
    await captureGuideStep(page, {
      instruction: 'Klik Simpan pada Rincian HPS',
      target: saveHpsButton,
      expected: 'Rincian HPS dan KBKI tersimpan.'
    });
    await saveHpsButton.click();
    await page.waitForTimeout(1000);

    const alertNotif = page.locator('#alert');
    await alertNotif.waitFor({
      state: 'visible',
      timeout: 15000
    }).catch(() => null);
    await page.waitForTimeout(1500);

    const savedTableText = await page.locator('#tbl-rincian').innerText();
    for (const item of items) {
      const expectedPrice = Number(item.harga).toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (!savedTableText.includes(expectedPrice)) {
        throw new Error(
          `Nilai HPS ${expectedPrice} tidak ditemukan setelah Simpan.`
        );
      }
    }

    // 4. Klik link Kembali
    await page.getByRole('link', { name: ' Kembali' }).click();
    await page.waitForTimeout(2000);
  }

  async uploadModalDokumen(linkName, absPath, submitAction) {
    const page = this.getActivePage();
    const documentLink = page.getByRole('link', { name: linkName });
    const partialUrl = await documentLink.getAttribute('href');
    const packageId = partialUrl?.match(/dokumennontender\/([^/]+)\//)?.[1];
    if (!packageId) {
      throw new Error(`ID paket tidak ditemukan dari link dokumen: ${partialUrl}`);
    }

    const fileName = path.basename(absPath);
    const partialResponse = await page.request.get(
      new URL(partialUrl, page.url()).toString()
    );
    const currentDocuments = await partialResponse.text();
    if (partialResponse.ok() && currentDocuments.includes(fileName)) {
      return;
    }

    await this.uploadSignedFile({
      page,
      packageId,
      absPath,
      saveUrl: `${new URL(page.url()).origin}/spse/dokumennontender/${packageId}/${submitAction}`,
      authorize: true,
    });
  }

  async uploadSignedFile({
    page,
    packageId,
    absPath,
    saveUrl,
    authorize = false,
    authorizationPath = 'otorisasiDataPaketPlUpload',
    extraForm = {},
  }) {
    const query = new URLSearchParams({
      'input[uploadSignedUrlReq][0][contentType]': 'application/pdf',
      'input[uploadSignedUrlReq][0][identifier]': '',
      'input[uploadSignedUrlReq][0][fileName]': path.basename(absPath),
      'input[uploadSignedUrlReq][0][isPublic]': 'false',
      isArchieve: 'true',
    });
    const baseUrl = new URL(page.url()).origin + '/spse';
    const signedResponse = await page.request.get(
      `${baseUrl}/getSignedUrl?${query}`
    );
    const signedBody = await signedResponse.json().catch(() => null);
    const signedData = signedBody?.result?.data;
    if (!signedResponse.ok() || !signedData?.signedUrl || !signedData?.fileId) {
      throw new Error(
        `Gagal meminta signed URL (${signedResponse.status()}): ${JSON.stringify(signedBody)}`
      );
    }

    if (authorize) {
      const authorization = await page.request.get(
        `${baseUrl}/${authorizationPath}`,
        { params: { id: packageId } }
      );
      if (!authorization.ok()) {
        throw new Error(`Otorisasi upload ditolak (${authorization.status()}).`);
      }
    }

    const storageUpload = await page.request.put(signedData.signedUrl, {
      data: fs.readFileSync(absPath),
      headers: { 'Content-Type': 'application/pdf' },
    });
    if (!storageUpload.ok()) {
      throw new Error(`Upload ke storage gagal (${storageUpload.status()}).`);
    }

    let uploadReady = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const statusResponse = await page.request.post(
        `${baseUrl}/uploadCheckStatus`,
        { form: { input: signedData.fileId } }
      );
      const statusBody = await statusResponse.json().catch(() => null);
      const status = statusBody?.data?.status;
      if (statusBody?.errors || status === 'UPLOAD_FAILED') {
        throw new Error(`Validasi upload gagal: ${JSON.stringify(statusBody)}`);
      }
      if (statusBody?.data == null || status === 'UPLOAD_SUCCESS') {
        uploadReady = true;
        break;
      }
      await page.waitForTimeout(1500);
    }
    if (!uploadReady) {
      throw new Error(
        `Status upload ${path.basename(absPath)} tidak selesai setelah 10 kali polling.`
      );
    }

    const saveResponse = await page.request.post(
      saveUrl,
      {
        form: {
          id: packageId,
          path: signedBody.path || '',
          fileId: signedData.fileId,
          ...extraForm,
        },
      }
    );
    const saveBody = await saveResponse.json().catch(async () => ({ raw: (await saveResponse.text()).slice(0, 1000) }));
    if (!saveResponse.ok() || saveBody?.success !== true) {
      throw new Error(
        `Metadata ${path.basename(absPath)} gagal disimpan (${saveResponse.status()}): ${JSON.stringify(saveBody)}`
      );
    }
  }

  async uploadDokumenLampiran(filePath) {
    const page = this.getActivePage();
    await page.bringToFront().catch(() => null);

    const absPath = filePath;
    if (!absPath || !fs.existsSync(absPath)) {
      throw new Error(`File upload SPSE tidak ditemukan: ${absPath}`);
    }

    // Upload Kerangka Acuan Kerja (KAK) / Spesifikasi
    const kakLink = page.getByRole('link', { name: /Kerangka Acuan Kerja \(KAK\)\// });
    if (await kakLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.uploadModalDokumen(
        /Kerangka Acuan Kerja \(KAK\)\//,
        absPath,
        'spekPpkSubmit'
      );
    }

    // Upload Rancangan Kontrak
    const kontrakLink = page.getByRole('link', { name: /Rancangan Kontrak/ });
    if (await kontrakLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.uploadModalDokumen(
        /Rancangan Kontrak/,
        absPath,
        'uploadSskkSubmit'
      );
    }

    // Upload Uraian Singkat Pekerjaan
    const uraianLink = page.getByRole('link', { name: /Uraian Singkat Pekerjaan/ });
    if (await uraianLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.uploadModalDokumen(
        /Uraian Singkat Pekerjaan/,
        absPath,
        'uploadUraianSubmit'
      );
    }

    // Muat ulang untuk membaca status kelengkapan terbaru dari server.
    await page.reload({ waitUntil: 'domcontentloaded' });

    const incompleteWarning = page.getByText(
      'Harap melengkapi Dokumen Persiapan Pengadaan!',
      { exact: true }
    );
    if (await incompleteWarning.isVisible({ timeout: 2000 }).catch(() => false)) {
      throw new Error(
        'Upload dokumen belum tersimpan: SPSE masih menandai Dokumen Persiapan Pengadaan sebagai belum lengkap.'
      );
    }

    // Klik Selanjutnya menuju Step 3
    // Coba berbagai variasi nama tombol Selanjutnya
    const selanjutnyaBtn = page.locator('button:has-text("Selanjutnya"), a:has-text("Selanjutnya")').first();
    await selanjutnyaBtn.waitFor({
      state: 'visible',
      timeout: 20000
    });
    await selanjutnyaBtn.scrollIntoViewIfNeeded().catch(() => null);
    await selanjutnyaBtn.click();
    await page.waitForTimeout(3000);
  }

  async selectPejabatAndSubmit(filePath) {
    let page = this.getActivePage();
    const contextPages = this.page.context().pages()
      .filter((candidate) => !candidate.isClosed())
      .reverse();
    for (const candidate of contextPages) {
      const hasStep3Controls = await candidate.locator(
        '#pilihPenanggungJawab, a[href*="/pilihpp"], a[href*="/pilihukpbj"], #kirimEmailPp, #kirimEmailPokja'
      ).count() > 0;
      if (hasStep3Controls) {
        page = candidate;
        this.activePage = candidate;
        break;
      }
    }
    await page.bringToFront().catch(() => null);

    const absPath = filePath;
    if (!absPath || !fs.existsSync(absPath)) {
      throw new Error(`File upload SPSE tidak ditemukan: ${absPath}`);
    }

    // 1. Pilih penanggung jawab. Penunjukan Langsung dapat meminta Kepala
    // UKPBJ melalui dropdown, sedangkan Pengadaan Langsung langsung meminta
    // Pejabat Pengadaan tanpa menampilkan dropdown tersebut.
    const responsibilitySelect = page.locator('#pilihPenanggungJawab');
    const usesResponsibilitySelect = await responsibilitySelect.isVisible(
      { timeout: 3000 }
    ).catch(() => false);
    let assignedRole = usesResponsibilitySelect
      ? 'Kepala UKPBJ'
      : 'Pejabat Pengadaan';

    if (usesResponsibilitySelect) {
      const currentResponsibility = await responsibilitySelect.inputValue()
        .catch(() => '');
      if (currentResponsibility !== 'ukpbj') {
        await responsibilitySelect.selectOption('ukpbj');
        await responsibilitySelect.dispatchEvent('change');
      }
    }

    const pilihPejabatLink = assignedRole === 'Kepala UKPBJ'
      ? page.locator('a[href*="/pilihukpbj"]:visible').first()
      : page.locator('a[href*="/pilihpp"]:visible').first();
    const chooserIsVisible = await pilihPejabatLink.waitFor({
      state: 'visible',
      timeout: 15000
    }).then(() => true).catch(() => false);
    if (chooserIsVisible) {
      const selectionUrl = await pilihPejabatLink.getAttribute('href');
      const expectedRole = selectionUrl?.includes('/pilihpp')
        ? 'Pejabat Pengadaan'
        : 'Kepala UKPBJ';
      assignedRole = expectedRole;

      if (!selectionUrl) {
        throw new Error(`URL pemilihan ${expectedRole} tidak tersedia.`);
      }

      // Navigasi klik kadang berhenti pada halaman kosong meskipun href sudah
      // tersedia. Buka URL yang diberikan server secara langsung agar daftar
      // pejabat dimuat deterministik dalam tab yang sama.
      const absoluteSelectionUrl = new URL(
        selectionUrl,
        page.url()
      ).toString();
      await page.goto(absoluteSelectionUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      const pilihBtn = page.getByRole('link', {
        name: 'Pilih',
        exact: true
      }).first();
      await pilihBtn.waitFor({
        state: 'visible',
        timeout: 60000
      });
      await pilihBtn.click();
      await page.waitForURL(/\/edit\?step=3/, { timeout: 30000 });

      const initialChooser = page.getByRole(
        'link',
        { name: new RegExp(`^Pilih ${expectedRole}$`, 'i') }
      );
      if (await initialChooser.isVisible(
        { timeout: 3000 }
      ).catch(() => false)) {
        throw new Error(`${expectedRole} belum berhasil dipilih.`);
      }
    } else {
      const emailControl = page.locator(
        '#kirimEmailPp, #kirimEmailPokja'
      ).first();
      if (!await emailControl.isVisible({ timeout: 3000 }).catch(() => false)) {
        const pageDiagnostics = await Promise.all(
          this.page.context().pages().map(async (candidate) => ({
            url: candidate.url(),
            title: await candidate.title().catch(() => ''),
            step3ControlCount: await candidate.locator(
              '#pilihPenanggungJawab, a[href*="/pilihpp"], a[href*="/pilihukpbj"], #kirimEmailPp, #kirimEmailPokja'
            ).count().catch(() => -1),
            selectionLinks: await candidate.locator('a').evaluateAll(
              (links) => links.map((link) => ({
                text: link.textContent?.replace(/\s+/g, ' ').trim(),
                href: link.getAttribute('href')
              })).filter((link) =>
                /pilih|ukpbj|pejabat/i.test(
                  `${link.text || ''} ${link.href || ''}`
                )
              )
            ).catch(() => [])
          }))
        );
        throw new Error(
          `Kontrol pemilihan Kepala UKPBJ/Pejabat Pengadaan tidak ditemukan pada Step 3. Diagnostik tab: ${JSON.stringify(pageDiagnostics)}`
        );
      }
    }

    if (usesResponsibilitySelect) {
      const selectedResponsibility = await page.locator(
        '#pilihPenanggungJawab option:checked'
      ).textContent();
      if (!/Kepala UKPBJ/i.test(selectedResponsibility || '')) {
        throw new Error(
          `Kepala UKPBJ belum terpilih. Penanggung jawab aktual: "${selectedResponsibility}".`
        );
      }
    }

    // 2. Upload Nota Dinas PPK dengan signed-upload langsung. Endpoint ini
    // memakai step=1 untuk lampiran dari PPK dan tidak membutuhkan ACL call.
    const packageId = page.url().match(/paketnontender\/([^/?]+)/)?.[1];
    if (!packageId) {
      throw new Error(`ID paket Step 3 tidak ditemukan dari URL: ${page.url()}`);
    }
    const existingAttachment = page.locator('#files').getByText(
      path.basename(absPath),
      { exact: false }
    );
    if (!await existingAttachment.isVisible().catch(() => false)) {
      await this.uploadSignedFile({
        page,
        packageId,
        absPath,
        saveUrl: `${new URL(page.url()).origin}/spse/paketnontender/${packageId}/uploadAttachment`,
        extraForm: { step: 1 },
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    // 3. Klik Kirim Email
    const kirimEmailBtn = page.locator(
      '#kirimEmailPp:visible, #kirimEmailPokja:visible, button:has-text("Kirim Email"):visible'
    ).first();
    const emailAlreadySent = page.getByText('Sudah dikirim', { exact: false }).first();
    if (!await emailAlreadySent.isVisible().catch(() => false)) {
      await kirimEmailBtn.waitFor({
        state: 'visible',
        timeout: 30000
      });
      await kirimEmailBtn.waitFor({
        state: 'visible',
        timeout: 60000
      });
      await page.waitForFunction(
        () => {
          const button = document.querySelector(
            '#kirimEmailPp, #kirimEmailPokja'
          );
          return button && !button.disabled;
        },
        null,
        { timeout: 60000 }
      );
      await captureGuideStep(page, {
        instruction: `Klik Kirim Email kepada ${assignedRole}`,
        target: kirimEmailBtn,
        expected: 'Status email berubah menjadi Sudah dikirim.'
      });
      await kirimEmailBtn.click();

      const confirmBtn = page.locator(
        '.bootstrap-dialog-footer-buttons button:has-text("OK"), .bootstrap-dialog-footer-buttons button:has-text("Ya"), .modal-dialog button:has-text("OK")'
      ).last();
      await confirmBtn.waitFor({
        state: 'visible',
        timeout: 10000
      });
      await confirmBtn.click();
      await emailAlreadySent.waitFor({
        state: 'visible',
        timeout: 30000
      });
    }

    // 4. Klik Simpan dan Membuat Paket
    const simpanBuatPaketBtn = page.locator('#simpan');
    await simpanBuatPaketBtn.waitFor({
      state: 'visible',
      timeout: 15000
    });
    await simpanBuatPaketBtn.scrollIntoViewIfNeeded();
    await captureGuideStep(page, {
      instruction: `Klik Simpan untuk membuat paket dan meneruskan ke ${assignedRole}`,
      target: simpanBuatPaketBtn,
      expected: 'Data paket tersimpan dan manifest Flow 1 dibuat.'
    });
    await simpanBuatPaketBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Data paket telah tersimpan', { exact: true }).waitFor({
      state: 'visible',
      timeout: 30000
    });
    return {
      packageId,
      packageUrl: page.url(),
      assignedRole,
      status: assignedRole === 'Kepala UKPBJ'
        ? 'SENT_TO_UKPBJ'
        : 'SENT_TO_PROCUREMENT_OFFICER'
    };
  }
}

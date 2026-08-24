import { test, expect } from '../../fixtures/workflow.fixture.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';

function compact(value) {
  return value.replace(/\s+/g, ' ').trim();
}

async function describePage(page, label) {
  // Diagnostic output is intentionally printed for Flow 6 form analysis.
  // eslint-disable-next-line no-console
  console.log(`${label}_URL`, page.url());
  // eslint-disable-next-line no-console
  console.log(`${label}_TEXT`, compact(await page.locator('#main').innerText()));
  // eslint-disable-next-line no-console
  console.log(`${label}_CONTROLS`, JSON.stringify(await page.locator(
    'a,button,input,textarea,select,option'
  ).evaluateAll((nodes) => nodes.map((node) => ({
    tag: node.tagName,
    text: (node.innerText || node.value || '').replace(/\s+/g, ' ').trim(),
    href: node.getAttribute('href'),
    id: node.id,
    name: node.getAttribute('name'),
    type: node.getAttribute('type'),
    checked: node.checked,
    disabled: node.disabled,
  })).filter((item) => item.text || item.href || item.id || item.name))));
}

test('inspeksi seluruh form Flow 6 tanpa mengirim penawaran', { tag: ['@QA-T1', '@feature:flow6'], }, async ({
  page,
  spseBaseUrl,
  packageManifest,
  providerActor,
  flow6Scenario,
}, testInfo) => {
  test.setTimeout(600000);
  const { manifest } = packageManifest;
  expect([
    'FLOW5_EXPLANATION_COMPLETED',
    'FLOW6_QUALIFICATION_SENT',
    'FLOW6_OFFER_LETTER_SENT',
    'FLOW6_TECHNICAL_SENT',
  ]).toContain(manifest.status);

  const login = new ProviderLoginPage(page);
  const activePage = await login.login(providerActor, spseBaseUrl);
  const session = new TrainingSessionPage(activePage);
  await session.activateAndSetTime(
    flow6Scenario.sessionNumber,
    flow6Scenario.offerTime,
    { stageName: 'tahap Upload Dokumen Penawaran', }
  );
  const packages = new ProviderPackagePage(activePage);
  await packages.openAcceptedNonTenderPackageFromHome(manifest);
  await expect(activePage.locator('#main')).toContainText(
    'Upload Dokumen Penawaran'
  );
  await describePage(activePage, 'FLOW6_MAIN');

  const candidateLinks = await activePage.locator('#main a').evaluateAll(
    (links) => links.map((link) => ({
      text: (link.innerText || '').replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href'),
    })).filter(({ text, href }) => href
      && /Kualifikasi|Penawaran|Kirim Data/i.test(text)
      && !/getexcell(?:template|dkh)|\/dlsec\/|download/i.test(href))
  );
  const queue = candidateLinks.map((candidate) => ({
    ...candidate,
    href: new URL(candidate.href, activePage.url()).href,
  }));
  const visited = new Set();
  let detailNumber = 0;
  while (queue.length > 0 && detailNumber < 12) {
    const candidate = queue.shift();
    if (visited.has(candidate.href)) {
      continue;
    }
    visited.add(candidate.href);
    detailNumber++;
    const detailPage = await activePage.context().newPage();
    await detailPage.goto(candidate.href, { waitUntil: 'domcontentloaded', });
    await describePage(detailPage, `FLOW6_DETAIL_${detailNumber}`);
    await detailPage.screenshot({
      path: testInfo.outputPath(`flow6-detail-${detailNumber}.png`),
      fullPage: true,
    });
    const nestedLinks = await detailPage.locator('#main a').evaluateAll(
      (links) => links.map((link) => ({
        text: (link.innerText || '').replace(/\s+/g, ' ').trim(),
        href: link.getAttribute('href'),
      })).filter(({ text, href }) => href
        && /Penawaran|Teknis|Harga|Tanda Terima|Bukti/i.test(text)
        && !/getexcell(?:template|dkh)|\/dlsec\/|download/i.test(href))
    );
    for (const nestedLink of nestedLinks) {
      const nestedUrl = new URL(nestedLink.href, detailPage.url());
      if (nestedUrl.origin === new URL(activePage.url()).origin
        && !visited.has(nestedUrl.href)) {
        queue.push({
          text: nestedLink.text,
          href: nestedUrl.href,
        });
      }
    }
    await detailPage.close();
  }
});

import { test, expect } from '../../fixtures/workflow.fixture.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { ProviderOfferPage } from '../../pom/paket/provider-offer.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import {
  PACKAGE_STATUS,
  transitionPackageManifest,
} from '../../utils/package-manifest.js';

const OFFER_STATUSES = [
  PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT,
  PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT,
  PACKAGE_STATUS.FLOW6_TECHNICAL_SENT,
  PACKAGE_STATUS.FLOW6_PRICE_SAVED,
  PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
];

async function openProviderOfferContext({
  page,
  spseBaseUrl,
  manifest,
  providerActor,
  scenario,
  openPackage = false,
}) {
  const login = new ProviderLoginPage(page);
  const activePage = await login.login(providerActor, spseBaseUrl);
  const session = new TrainingSessionPage(activePage);
  await session.activateAndSetTime(
    scenario.sessionNumber,
    scenario.offerTime,
    { stageName: 'tahap Upload Dokumen Penawaran' }
  );
  if (openPackage) {
    const packages = new ProviderPackagePage(activePage);
    await packages.openAcceptedNonTenderPackageFromHome(manifest);
  }
  return {
    activePage,
    offer: new ProviderOfferPage(activePage),
  };
}

function expectedOfferTotal(scenario) {
  return scenario.offer.priceBeforeVat
    * (1 + scenario.offer.vatPercent / 100);
}

test.describe('Flow 6 Dokumen Penawaran Penyedia', () => {
  test.describe.configure({ mode: 'serial' });

  test('Penyedia menyetujui Surat Penawaran', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    providerActor,
    flow6Scenario,
  }) => {
    test.setTimeout(300000);
    const { manifestPath, manifest } = packageManifest;
    expect(OFFER_STATUSES).toContain(manifest.status);
    const { activePage, offer } = await openProviderOfferContext({
      page,
      spseBaseUrl,
      manifest,
      providerActor,
      scenario: flow6Scenario,
      openPackage: manifest.status === PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT,
    });

    if (manifest.status === PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT) {
      const statusBeforeAction = await offer.readOfferStatus();
      if (!offer.hasOfferLetterBeenSent(statusBeforeAction)) {
        await offer.openOfferFromPackage();
        await offer.agreeOfferLetter(flow6Scenario.offer.validityDays);
      }
    }
    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded' });
    const status = await offer.readOfferStatus();
    offer.assertOfferLetterSent(status);

    if (manifest.status === PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT) {
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT,
        to: PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT,
        expectedRevision: manifest.revision,
        actor: providerActor.displayName,
        reason: 'Surat Penawaran disetujui dan status server tervalidasi.',
        updates: {
          flow6OfferValidityDays: flow6Scenario.offer.validityDays,
          flow6OfferStatusAfterLetter: status,
          flow6OfferLetterSentAt: manifest.flow6OfferLetterSentAt
            || new Date().toISOString(),
        },
      });
    }
  });

  test('Penyedia mengunggah seluruh Dokumen Penawaran Teknis', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    providerActor,
    flow6Scenario,
  }) => {
    test.setTimeout(600000);
    const { manifestPath, manifest } = packageManifest;
    expect(OFFER_STATUSES.slice(1)).toContain(manifest.status);
    const { activePage, offer } = await openProviderOfferContext({
      page,
      spseBaseUrl,
      manifest,
      providerActor,
      scenario: flow6Scenario,
      openPackage: manifest.status === PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT,
    });

    let uploads = manifest.flow6TechnicalUploads || [];
    if (manifest.status === PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT) {
      await offer.openTechnicalOffer(manifest);
      uploads = await offer.uploadAllTechnicalFiles(
        flow6Scenario.offer.technicalFile
      );
      if (uploads.length === 0) {
        throw new Error(
          'Tidak ada persyaratan Dokumen Penawaran Teknis pada UI.'
        );
      }
    }
    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded' });
    const status = await offer.readOfferStatus();
    offer.assertTechnicalOfferSent(status);

    if (manifest.status === PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT) {
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT,
        to: PACKAGE_STATUS.FLOW6_TECHNICAL_SENT,
        expectedRevision: manifest.revision,
        actor: providerActor.displayName,
        reason: 'Semua persyaratan teknis pada UI terunggah dan tervalidasi.',
        updates: {
          flow6TechnicalUploads: uploads,
          flow6OfferStatusAfterTechnical: status,
          flow6TechnicalSentAt: manifest.flow6TechnicalSentAt
            || new Date().toISOString(),
        },
      });
    }
  });

  test('Penyedia mengisi harga, PPN, TKDN, dan lampiran harga', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    providerActor,
    flow6Scenario,
  }) => {
    test.setTimeout(600000);
    const { manifestPath, manifest } = packageManifest;
    expect(OFFER_STATUSES.slice(2)).toContain(manifest.status);
    const { activePage, offer } = await openProviderOfferContext({
      page,
      spseBaseUrl,
      manifest,
      providerActor,
      scenario: flow6Scenario,
      openPackage: manifest.status === PACKAGE_STATUS.FLOW6_TECHNICAL_SENT,
    });

    let uploads = manifest.flow6PriceRequirementUploads || [];
    let price = manifest.flow6Price;
    if (manifest.status === PACKAGE_STATUS.FLOW6_TECHNICAL_SENT) {
      const statusBeforeAction = await offer.readOfferStatus();
      const priceAlreadySent = offer.hasPriceOfferBeenSent(
        statusBeforeAction,
        expectedOfferTotal(flow6Scenario)
      );
      await offer.openPriceOffer(manifest);
      uploads = await offer.uploadPriceRequirementFiles(
        flow6Scenario.offer.priceRequirementFiles
      );
      if (priceAlreadySent) {
        price = await offer.assertSavedPrice(flow6Scenario.offer);
      } else {
        price = await offer.fillAndSavePrice(flow6Scenario.offer);
      }
    }

    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded' });
    const status = await offer.readOfferStatus();
    offer.assertPriceOfferSent(status, expectedOfferTotal(flow6Scenario));

    if (manifest.status === PACKAGE_STATUS.FLOW6_TECHNICAL_SENT) {
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.FLOW6_TECHNICAL_SENT,
        to: PACKAGE_STATUS.FLOW6_PRICE_SAVED,
        expectedRevision: manifest.revision,
        actor: providerActor.displayName,
        reason: 'Harga, PPN, TKDN, dan lampiran harga tersimpan.',
        updates: {
          flow6PriceRequirementUploads: uploads,
          flow6Price: price,
          flow6OfferStatusAfterPrice: status,
          flow6PriceSavedAt: manifest.flow6PriceSavedAt
            || new Date().toISOString(),
        },
      });
    }
  });

  test('Penyedia memvalidasi pengiriman akhir dan bukti elektronik', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    providerActor,
    flow6Scenario,
  }) => {
    test.setTimeout(300000);
    const { manifestPath, manifest } = packageManifest;
    expect([
      PACKAGE_STATUS.FLOW6_PRICE_SAVED,
      PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
    ]).toContain(manifest.status);
    const { activePage, offer } = await openProviderOfferContext({
      page,
      spseBaseUrl,
      manifest,
      providerActor,
      scenario: flow6Scenario,
    });
    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href, { waitUntil: 'domcontentloaded' });
    const evidence = await offer.collectFinalSubmissionEvidence(
      expectedOfferTotal(flow6Scenario)
    );

    if (manifest.status === PACKAGE_STATUS.FLOW6_PRICE_SAVED) {
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.FLOW6_PRICE_SAVED,
        to: PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
        expectedRevision: manifest.revision,
        actor: providerActor.displayName,
        reason: 'Pengiriman akhir dan bukti elektronik tervalidasi.',
        updates: {
          flow6FinalSubmissionEvidence: evidence,
          flow6CompletedAt: new Date().toISOString(),
        },
      });
    }
  });
});

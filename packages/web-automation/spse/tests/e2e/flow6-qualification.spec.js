import { test, expect } from '../../fixtures/workflow.fixture.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { ProviderOfferPage } from '../../pom/paket/provider-offer.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import {
  PACKAGE_STATUS,
  transitionPackageManifest,
} from '../../utils/package-manifest.js';

const QUALIFICATION_COMPATIBLE_STATUSES = [
  PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED,
  PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT,
  PACKAGE_STATUS.FLOW6_OFFER_LETTER_SENT,
  PACKAGE_STATUS.FLOW6_TECHNICAL_SENT,
  PACKAGE_STATUS.FLOW6_PRICE_SAVED,
  PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
];

test('Flow 6 memastikan Data Kualifikasi Penyedia terkirim', { tag: ['@QA-T1', '@feature:flow6', '@e2e'], }, async ({
  page,
  spseBaseUrl,
  packageManifest,
  providerActor,
  flow6Scenario,
}) => {
  test.setTimeout(600000);
  const { manifestPath, manifest } = packageManifest;
  expect(QUALIFICATION_COMPATIBLE_STATUSES).toContain(manifest.status);

  const login = new ProviderLoginPage(page);
  const activePage = await login.login(providerActor, spseBaseUrl);
  const session = new TrainingSessionPage(activePage);
  await session.activateAndSetTime(
    flow6Scenario.sessionNumber,
    flow6Scenario.offerTime,
    { stageName: 'tahap Upload Dokumen Penawaran' }
  );
  const packages = new ProviderPackagePage(activePage);
  await packages.openAcceptedNonTenderPackageFromHome(manifest);

  const offerPage = new ProviderOfferPage(activePage);
  let reconciledFromServer = false;
  let qualificationResult = {
    selections: manifest.flow6QualificationSelections,
    upload: manifest.flow6QualificationUpload,
  };
  if (manifest.status === PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED) {
    const statusBeforeAction = await offerPage.readQualificationStatus();
    reconciledFromServer = offerPage.hasQualificationBeenSent(
      statusBeforeAction
    );
    if (!reconciledFromServer) {
      await offerPage.openQualificationFromPackage();
      qualificationResult = await offerPage.fillAndSendQualification(
        flow6Scenario.qualification
      );
    }
  }

  await activePage.goto(new URL(
    `/spse/nontender/${manifest.procurementPackageId}`,
    activePage.url()
  ).href, { waitUntil: 'domcontentloaded' });
  const qualificationStatus = await offerPage.assertQualificationSent();

  if (manifest.status === PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED) {
    const qualificationUpdates = {
      flow6QualificationStatus: qualificationStatus,
      flow6QualificationReconciledFromServer: reconciledFromServer,
      flow6QualificationSentAt: new Date().toISOString(),
      ...(qualificationResult.selections === undefined
        ? {}
        : { flow6QualificationSelections: qualificationResult.selections }),
      ...(qualificationResult.upload === undefined
        ? {}
        : { flow6QualificationUpload: qualificationResult.upload }),
    };
    transitionPackageManifest(manifestPath, {
      from: PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED,
      to: PACKAGE_STATUS.FLOW6_QUALIFICATION_SENT,
      expectedRevision: manifest.revision,
      actor: providerActor.displayName,
      reason: reconciledFromServer
        ? 'Status Data Kualifikasi direkonsiliasi dari server setelah proses terputus.'
        : 'Data Kualifikasi tersimpan dan status pascakirim tervalidasi.',
      updates: qualificationUpdates,
    });
  }
});

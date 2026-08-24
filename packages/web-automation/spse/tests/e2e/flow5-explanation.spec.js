import { test, expect } from '../../fixtures/workflow.fixture.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { ExplanationPage } from '../../pom/paket/explanation.page.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import {
  PACKAGE_STATUS,
  readPackageManifest,
  transitionPackageManifest,
  updatePackageManifest,
} from '../../utils/package-manifest.js';

test.describe('Flow 5 Pemberian Penjelasan Penunjukan Langsung', () => {
  test.describe.configure({ mode: 'serial' });

  test('Penyedia mengirim pertanyaan yang dikonfigurasi', { tag: ['@QA-T1', '@feature:flow5', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    providerActor,
    flow5Scenario,
  }) => {
    test.setTimeout(600000);
    const { manifestPath, manifest } = packageManifest;
    expect([
      PACKAGE_STATUS.ACCEPTED_BY_PROVIDER,
      PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT,
      PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED,
    ]).toContain(manifest.status);
    expect(manifest.jenisPengadaan).toBe('Pengadaan Barang');
    const attachmentQuestions = flow5Scenario.questions.filter(
      (question) => question.attachment
    );

    const loginPage = new ProviderLoginPage(page);
    const activePage = await loginPage.login(providerActor, spseBaseUrl);
    const sessionPage = new TrainingSessionPage(activePage);
    await sessionPage.activateAndSetTime(
      flow5Scenario.sessionNumber,
      flow5Scenario.explanationTime,
      { stageName: 'tahap Pemberian Penjelasan' }
    );
    const packagePage = new ProviderPackagePage(activePage);
    await packagePage.openAcceptedNonTenderPackageFromHome(manifest);
    const explanationPage = new ExplanationPage(activePage);
    await explanationPage.openFromPackage();

    let counters;
    for (const [index, question] of flow5Scenario.questions.entries()) {
      const result = await explanationPage.ensureQuestion(
        question,
        index + 1
      );
      counters = result.counters;
      if (result.created) {
        updatePackageManifest(manifestPath, {
          flow5ProviderQuestionCount: index + 1,
          flow5UiQuestionCount: counters.questions,
        });
      }
    }
    await activePage.reload({ waitUntil: 'domcontentloaded' });
    counters = await explanationPage.readCounters();
    expect(counters.questions).toBeGreaterThanOrEqual(
      flow5Scenario.questions.length
    );
    await explanationPage.verifyStoredQuestions(flow5Scenario.questions);
    const providerDownloads = await explanationPage
      .verifyAttachmentDownloads(attachmentQuestions, 'Penyedia');
    const latestManifest = readPackageManifest(manifestPath);
    if (latestManifest.status === PACKAGE_STATUS.ACCEPTED_BY_PROVIDER) {
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.ACCEPTED_BY_PROVIDER,
        to: PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT,
        expectedRevision: latestManifest.revision,
        actor: providerActor.displayName,
        reason: 'Seluruh pertanyaan Flow 5 tersimpan dan lampiran dapat diunduh.',
        updates: {
          flow5ProviderQuestionCount: flow5Scenario.questions.length,
          flow5UiQuestionCount: counters.questions,
          flow5ProviderQuestionsSentAt: new Date().toISOString(),
          flow5ProviderAttachmentDownloads: providerDownloads,
          flow5ProviderDownloadsValidatedAt: new Date().toISOString(),
        },
      });
    }
  });

  test('Pokja menjawab seluruh pertanyaan Penyedia', { tag: ['@QA-T1', '@feature:flow5', '@e2e'], }, async ({
    page,
    spseBaseUrl,
    packageManifest,
    pokjaOneActor,
    flow5Scenario,
  }) => {
    test.setTimeout(600000);
    const { manifestPath, manifest } = packageManifest;
    expect([
      PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT,
      PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED,
    ]).toContain(manifest.status);
    expect(manifest.jenisPengadaan).toBe('Pengadaan Barang');
    const attachmentQuestions = flow5Scenario.questions.filter(
      (question) => question.attachment
    );

    const loginPage = new PokjaLoginPage(page);
    const activePage = await loginPage.login(pokjaOneActor, spseBaseUrl);
    const sessionPage = new TrainingSessionPage(activePage);
    await sessionPage.activateAndSetTime(
      flow5Scenario.sessionNumber,
      flow5Scenario.explanationTime,
      { stageName: 'tahap Pemberian Penjelasan' }
    );

    const packagePage = new PokjaApprovalPage(activePage);
    await packagePage.openAssignedPackage(manifest);
    await activePage.goto(new URL(
      `/spse/nontender/${manifest.procurementPackageId}`,
      activePage.url()
    ).href);
    const explanationPage = new ExplanationPage(activePage);
    await explanationPage.openFromPackage();
    let counters = await explanationPage.readCounters();
    expect(counters.questions).toBeGreaterThanOrEqual(
      flow5Scenario.questions.length
    );
    await explanationPage.verifyStoredQuestions(flow5Scenario.questions);

    for (const [index, question] of flow5Scenario.questions.entries()) {
      const result = await explanationPage.ensureAnswer(
        question,
        flow5Scenario.answers[index],
        index + 1
      );
      counters = result.counters;
      if (result.created) {
        updatePackageManifest(manifestPath, {
          flow5PokjaAnswerCount: index + 1,
          flow5UiExplanationCount: counters.explanations,
        });
      }
    }
    await activePage.reload({ waitUntil: 'domcontentloaded' });
    counters = await explanationPage.readCounters();
    expect(counters.questions).toBeGreaterThanOrEqual(
      flow5Scenario.questions.length
    );
    expect(counters.explanations).toBeGreaterThanOrEqual(
      flow5Scenario.answers.length
    );
    await explanationPage.verifyStoredAnswers(
      flow5Scenario.questions,
      flow5Scenario.answers,
      flow5Scenario.answers.length
    );
    const pokjaDownloads = await explanationPage
      .verifyAttachmentDownloads(attachmentQuestions, 'Pokja');
    const latestManifest = readPackageManifest(manifestPath);
    if (latestManifest.status
      === PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT) {
      transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.FLOW5_PROVIDER_QUESTIONS_SENT,
        to: PACKAGE_STATUS.FLOW5_EXPLANATION_COMPLETED,
        expectedRevision: latestManifest.revision,
        actor: pokjaOneActor.displayName,
        reason: 'Seluruh jawaban Flow 5 tersimpan dan lampiran dapat diunduh.',
        updates: {
          flow5ProviderQuestionCount: flow5Scenario.questions.length,
          flow5PokjaAnswerCount: flow5Scenario.answers.length,
          flow5UiQuestionCount: counters.questions,
          flow5UiExplanationCount: counters.explanations,
          flow5Session: flow5Scenario.sessionNumber,
          flow5ExplanationTime: flow5Scenario.explanationTime,
          flow5PokjaAttachmentDownloads: pokjaDownloads,
          flow5PokjaDownloadsValidatedAt: new Date().toISOString(),
          flow5CompletedAt: new Date().toISOString(),
        },
      });
    }
  });
});

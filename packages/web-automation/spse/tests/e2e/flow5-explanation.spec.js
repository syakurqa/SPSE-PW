import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { env } from '../../../../common-module/config/index.js';
import { ProviderLoginPage } from '../../pom/auth/provider-login.page.js';
import { ProviderPackagePage } from '../../pom/paket/provider-package.page.js';
import { TrainingSessionPage } from '../../pom/training/training-session.page.js';
import { ExplanationPage } from '../../pom/paket/explanation.page.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import { flow5Data } from '../../fixtures/data/flow5.data.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test.describe('Flow 5 Pemberian Penjelasan Penunjukan Langsung', () => {
  test.describe.configure({ mode: 'serial' });

  test('Penyedia mengirim lima pertanyaan', { tag: ['@QA-T1', '@feature:flow5', '@e2e'], }, async ({ page }) => {
    test.setTimeout(600000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'ACCEPTED_BY_PROVIDER',
      'FLOW5_PROVIDER_QUESTIONS_SENT',
      'FLOW5_EXPLANATION_COMPLETED',
    ]).toContain(manifest.status);
    expect(manifest.jenisPengadaan).toBe('Pengadaan Barang');
    const attachmentQuestions = flow5Data.questions.filter(
      (question) => question.attachment
    );
    expect(attachmentQuestions).toHaveLength(2);

    const loginPage = new ProviderLoginPage(page);
    const activePage = await loginPage.login({
      username: process.env.SPSE_PROVIDER_USERNAME,
      password: process.env.SPSE_PROVIDER_PASSWORD,
    }, env.SPSE_PLATFORM.BASE_URL);
    const sessionPage = new TrainingSessionPage(activePage);
    await sessionPage.activateAndSetTime(
      flow5Data.sessionNumber,
      flow5Data.explanationTime
    );
    const packagePage = new ProviderPackagePage(activePage);
    await packagePage.openAcceptedNonTenderPackageFromHome(manifest);
    const explanationPage = new ExplanationPage(activePage);
    await explanationPage.openFromPackage();

    let counters = await explanationPage.readCounters();
    expect(counters.questions).toBeLessThanOrEqual(flow5Data.questions.length);
    await explanationPage.verifyStoredQuestions(
      flow5Data.questions.slice(0, counters.questions)
    );
    for (let index = counters.questions;
      index < flow5Data.questions.length;
      index++) {
      counters = await explanationPage.sendQuestion(
        flow5Data.questions[index],
        index + 1
      );
      updatePackageManifest(manifestPath, {
        status: 'ACCEPTED_BY_PROVIDER',
        flow5ProviderQuestionCount: counters.questions,
      });
    }
    await activePage.reload({ waitUntil: 'domcontentloaded' });
    counters = await explanationPage.readCounters();
    expect(counters.questions).toBe(flow5Data.questions.length);
    await explanationPage.verifyStoredQuestions(flow5Data.questions);
    const providerDownloads = await explanationPage
      .verifyAttachmentDownloads(attachmentQuestions, 'Penyedia');
    updatePackageManifest(manifestPath, {
      status: manifest.status === 'FLOW5_EXPLANATION_COMPLETED'
        ? manifest.status
        : 'FLOW5_PROVIDER_QUESTIONS_SENT',
      flow5ProviderQuestionCount: counters.questions,
      flow5ProviderQuestionsSentAt: new Date().toISOString(),
      flow5ProviderAttachmentDownloads: providerDownloads,
      flow5ProviderDownloadsValidatedAt: new Date().toISOString(),
    });
  });

  test('Pokja menjawab lima pertanyaan Penyedia', { tag: ['@QA-T1', '@feature:flow5', '@e2e'], }, async ({ page }) => {
    test.setTimeout(600000);
    const manifestPath = path.resolve(process.env.SPSE_PACKAGE_MANIFEST || '');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect([
      'FLOW5_PROVIDER_QUESTIONS_SENT',
      'FLOW5_EXPLANATION_COMPLETED',
    ]).toContain(manifest.status);
    expect(manifest.jenisPengadaan).toBe('Pengadaan Barang');
    const attachmentQuestions = flow5Data.questions.filter(
      (question) => question.attachment
    );
    expect(attachmentQuestions).toHaveLength(2);

    const loginPage = new PokjaLoginPage(page);
    const activePage = await loginPage.login({
      username: process.env.SPSE_POKJA_1_USERNAME,
      password: process.env.SPSE_POKJA_1_PASSWORD,
    }, env.SPSE_PLATFORM.BASE_URL);
    const sessionPage = new TrainingSessionPage(activePage);
    await sessionPage.activateAndSetTime(
      flow5Data.sessionNumber,
      flow5Data.explanationTime
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
    expect(counters.questions).toBe(flow5Data.questions.length);
    expect(counters.explanations).toBeLessThanOrEqual(
      flow5Data.answers.length
    );
    await explanationPage.verifyStoredQuestions(flow5Data.questions);
    await explanationPage.verifyStoredAnswers(
      flow5Data.questions,
      flow5Data.answers,
      counters.explanations
    );

    for (let index = counters.explanations;
      index < flow5Data.answers.length;
      index++) {
      counters = await explanationPage.sendAnswer(
        flow5Data.questions[index],
        flow5Data.answers[index],
        index + 1
      );
      updatePackageManifest(manifestPath, {
        status: 'FLOW5_PROVIDER_QUESTIONS_SENT',
        flow5PokjaAnswerCount: counters.explanations,
      });
    }
    await activePage.reload({ waitUntil: 'domcontentloaded' });
    counters = await explanationPage.readCounters();
    expect(counters).toEqual({
      questions: flow5Data.questions.length,
      explanations: flow5Data.answers.length,
    });
    await explanationPage.verifyStoredAnswers(
      flow5Data.questions,
      flow5Data.answers,
      counters.explanations
    );
    const pokjaDownloads = await explanationPage
      .verifyAttachmentDownloads(attachmentQuestions, 'Pokja');
    updatePackageManifest(manifestPath, {
      status: 'FLOW5_EXPLANATION_COMPLETED',
      flow5ProviderQuestionCount: counters.questions,
      flow5PokjaAnswerCount: counters.explanations,
      flow5Session: flow5Data.sessionNumber,
      flow5ExplanationTime: flow5Data.explanationTime,
      flow5PokjaAttachmentDownloads: pokjaDownloads,
      flow5PokjaDownloadsValidatedAt: new Date().toISOString(),
      flow5CompletedAt: new Date().toISOString(),
    });
  });
});

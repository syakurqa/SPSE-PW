import { test, expect } from '../../fixtures/base.fixture.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import {
  PACKAGE_STATUS,
  readPackageManifest,
  transitionPackageManifest,
  updatePackageManifest,
} from '../../utils/package-manifest.js';

const COMPLETED_MEMBERS_BY_STATUS = {
  [PACKAGE_STATUS.POKJA_1_APPROVED]: [1],
  [PACKAGE_STATUS.POKJA_2_APPROVED]: [1, 2],
  [PACKAGE_STATUS.POKJA_APPROVED]: [1, 2, 3],
};

const APPROVAL_TRANSITIONS = {
  1: {
    from: PACKAGE_STATUS.SENT_TO_POKJA,
    to: PACKAGE_STATUS.POKJA_1_APPROVED,
  },
  2: {
    from: PACKAGE_STATUS.POKJA_1_APPROVED,
    to: PACKAGE_STATUS.POKJA_2_APPROVED,
  },
  3: {
    from: PACKAGE_STATUS.POKJA_2_APPROVED,
    to: PACKAGE_STATUS.POKJA_APPROVED,
  },
};

function completedMemberIndexes(manifest) {
  // Status adalah checkpoint transaksi yang authoritative. Evidence approval
  // yang lebih maju dari status tidak boleh membuat transisi berikutnya lompat.
  return new Set(COMPLETED_MEMBERS_BY_STATUS[manifest.status] || []);
}

test.describe('SPSE Persetujuan Non-Tender oleh tiga anggota Pokja', () => {
  test('Tiga anggota Pokja menyetujui paket yang sama secara berurutan', { tag: ['@QA-T1', '@e2e'], }, async ({
    browser,
    spseBaseUrl,
    pokjaApprovalData,
  }) => {
    test.setTimeout(900000);
    const { manifestPath, members } = pokjaApprovalData;
    let manifest = pokjaApprovalData.manifest;
    const completedMembers = completedMemberIndexes(manifest);
    const recordedApprovalIndexes = new Set(
      (manifest.pokjaApprovals || []).map(({ memberIndex }) => memberIndex)
    );
    const missingApprovalEvidence = [...completedMembers].filter(
      (memberIndex) => !recordedApprovalIndexes.has(memberIndex)
    );
    if (missingApprovalEvidence.length > 0) {
      const recoveredApprovals = missingApprovalEvidence.map(
        (memberIndex) => ({
          memberIndex,
          member: members[memberIndex - 1]?.label || `Pokja ${memberIndex}`,
          approvedAt: manifest.approvedAt || new Date().toISOString(),
          recoveredFromStatus: true,
        })
      );
      updatePackageManifest(manifestPath, {
        pokjaApprovals: [
          ...(manifest.pokjaApprovals || []),
          ...recoveredApprovals,
        ].sort((left, right) => left.memberIndex - right.memberIndex),
      });
      manifest = readPackageManifest(manifestPath);
    }

    // Manifest lama belum memiliki checkpoint konfigurasi. Adanya approval
    // membuktikan konfigurasi wajib sudah selesai sebelum Pakta Integritas.
    if ((completedMembers.size > 0 || manifest.pokjaApprovals?.length > 0)
      && !manifest.flow3ConfigurationCompletedAt) {
      updatePackageManifest(manifestPath, {
        flow3ConfigurationCompletedAt:
          manifest.pokjaApprovals?.[0]?.approvedAt || new Date().toISOString(),
        flow3ConfigurationRecoveredFromLegacyManifest: true,
      });
      manifest = readPackageManifest(manifestPath);
    }

    for (const member of members) {
      if (completedMembers.has(member.index)) {
        continue;
      }

      await test.step(`${member.label} login dengan sesi terisolasi`, async () => {
        const context = await browser.newContext();
        const initialPage = await context.newPage();
        try {
          const loginPage = new PokjaLoginPage(initialPage);
          const activePage = await loginPage.login(member, spseBaseUrl);
          const approvalPage = new PokjaApprovalPage(activePage);

          await approvalPage.openAssignedPackage(manifest);
          if (approvalPage.activePackageId
            && manifest.procurementPackageId !== approvalPage.activePackageId) {
            updatePackageManifest(manifestPath, { procurementPackageId: approvalPage.activePackageId, });
            manifest = readPackageManifest(manifestPath);
          }
          await expect(activePage.locator('#main')).toContainText(
            manifest.packageName
          );

          if (!manifest.flow3ConfigurationCompletedAt) {
            await approvalPage.configurePackage(pokjaApprovalData);
            updatePackageManifest(manifestPath, {
              flow3ConfigurationCompletedAt: new Date().toISOString(),
              flow3ConfiguredByMember: member.index,
            });
            manifest = readPackageManifest(manifestPath);
          }

          if (process.env.SPSE_DEBUG_FLOW3 === 'true') {
            await activePage.screenshot({
              path: `/tmp/flow3-pokja-${member.index}-edit-full.png`,
              fullPage: true,
            });
          }
          await approvalPage.approveIntegrityPact();

          const approval = {
            memberIndex: member.index,
            member: member.label,
            approvedAt: new Date().toISOString(),
          };
          const approvalsByMember = new Map(
            (manifest.pokjaApprovals || []).map((item) => [
              item.memberIndex,
              item,
            ])
          );
          approvalsByMember.set(member.index, approval);
          const transition = APPROVAL_TRANSITIONS[member.index];
          manifest = transitionPackageManifest(manifestPath, {
            ...transition,
            expectedRevision: manifest.revision,
            actor: member.label,
            reason: `Pakta Integritas ${member.label} disetujui.`,
            updates: {
              pokjaApprovals: [...approvalsByMember.values()].sort(
                (left, right) => left.memberIndex - right.memberIndex
              ),
            },
          });
          completedMembers.add(member.index);
        } finally {
          await context.close();
        }
      });
    }

    manifest = readPackageManifest(manifestPath);
    expect(manifest.status).toBe(PACKAGE_STATUS.POKJA_APPROVED);
    expect(manifest.pokjaApprovals.map(({ memberIndex }) => memberIndex))
      .toEqual([1, 2, 3]);
  });
});

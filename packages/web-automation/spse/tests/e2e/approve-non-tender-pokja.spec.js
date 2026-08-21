import { test, expect } from '../../fixtures/base.fixture.js';
import { PokjaLoginPage } from '../../pom/auth/pokja-login.page.js';
import { PokjaApprovalPage } from '../../pom/paket/pokja-approval.page.js';
import { updatePackageManifest } from '../../utils/package-manifest.js';

test.describe('SPSE Persetujuan Non-Tender oleh tiga anggota Pokja', () => {
  test('Tiga anggota Pokja menyetujui paket yang sama secara berurutan', {
    tag: [
      '@QA-T1',
      '@e2e'
    ]
  }, async ({
    browser,
    spseBaseUrl,
    pokjaApprovalData,
  }) => {
    test.setTimeout(900000);
    const {
      manifest,
      manifestPath,
      members,
    } = pokjaApprovalData;
    const completedByStatus = {
      POKJA_1_APPROVED: [1],
      POKJA_2_APPROVED: [1, 2],
      POKJA_APPROVED: [1, 2, 3],
    }[manifest.status] || [];
    const completedMembers = new Set([
      ...completedByStatus,
      ...(manifest.pokjaApprovals?.map(({ memberIndex }) => memberIndex) || [])
    ]);

    for (const member of members) {
      if (completedMembers.has(member.index)) {
        continue;
      }

      await test.step(`${member.label} login dengan sesi terisolasi`, async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
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
              manifest.procurementPackageId = approvalPage.activePackageId;
            }
            await expect(activePage.locator('#main')).toContainText(
              manifest.packageName
            );

            if (member.index === 1
              && manifest.status === 'SENT_TO_POKJA') {
              await approvalPage.configurePackage(pokjaApprovalData);
            }
            if (process.env.SPSE_DEBUG_FLOW3 === 'true') {
              await activePage.screenshot({
                path: '/tmp/flow3-pokja-edit-full.png',
                fullPage: true,
              });
            }
            await approvalPage.approveIntegrityPact();

            const approval = {
              memberIndex: member.index,
              member: member.label,
              username: member.username,
              approvedAt: new Date().toISOString(),
            };
            const pokjaApprovals = [
              ...(manifest.pokjaApprovals || []),
              approval,
            ];
            const status = member.index === 3
              ? 'POKJA_APPROVED'
              : `POKJA_${member.index}_APPROVED`;
            updatePackageManifest(manifestPath, {
              status,
              pokjaApprovals,
            });
            manifest.status = status;
            manifest.pokjaApprovals = pokjaApprovals;
            return;
          } catch (error) {
            const retryableGatewayFailure = /Login Pokja gagal|Akses Anda Ditolak|Pilihan role Pokja tidak tersedia/.test(
              error.message
            );
            if (!retryableGatewayFailure || attempt === 3) {
              throw error;
            }
          } finally {
            await context.close();
          }
        }
      });
    }

    expect(manifest.status).toBe('POKJA_APPROVED');
    expect(manifest.pokjaApprovals).toHaveLength(3);
  });
});

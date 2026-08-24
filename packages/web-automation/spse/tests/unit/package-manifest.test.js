import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  describe,
  test,
} from 'node:test';
import {
  ManifestConflictError,
  ManifestTransitionError,
  ManifestValidationError,
  PACKAGE_MANIFEST_SCHEMA_VERSION,
  PACKAGE_STATUS,
  isKnownPackageStatus,
  readPackageManifest,
  transitionPackageManifest,
  updatePackageManifest,
  validatePackageManifest,
  writePackageManifest,
} from '../../utils/package-manifest.js';

const temporaryDirectories = [];

function createTemporaryManifestPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spse-manifest-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'package.json');
}

function baseManifest(overrides = {}) {
  return {
    packageId: 'PACKAGE-001',
    packageName: 'Paket Pengadaan Barang QA',
    packageType: 'Non-Tender',
    metodePemilihan: 'Penunjukan Langsung',
    jenisPengadaan: 'Pengadaan Barang',
    satker: 'DINAS KESEHATAN',
    assignedRole: 'Kepala UKPBJ',
    status: PACKAGE_STATUS.SENT_TO_UKPBJ,
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});

describe('package manifest', () => {
  test('menyediakan constants status Flow 1 sampai Flow 6', () => {
    assert.equal(
      PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
      'FLOW6_SUBMISSION_COMPLETED'
    );
    assert.equal(isKnownPackageStatus(PACKAGE_STATUS.POKJA_APPROVED), true);
    assert.equal(isKnownPackageStatus('FLOW7_QUALIFICATION_PROVEN'), false);
    assert.equal(Object.isFrozen(PACKAGE_STATUS), true);
  });

  test('write tetap mengembalikan path dan membuat revision/history awal', () => {
    const manifestPath = createTemporaryManifestPath();

    const result = writePackageManifest(baseManifest(), manifestPath);
    const stored = readPackageManifest(manifestPath, {
      allowedStatuses: [PACKAGE_STATUS.SENT_TO_UKPBJ],
      requiredFields: ['jenisPengadaan'],
    });

    assert.equal(result, manifestPath);
    assert.equal(stored.schemaVersion, PACKAGE_MANIFEST_SCHEMA_VERSION);
    assert.equal(stored.revision, 1);
    assert.equal(stored.history.length, 1);
    assert.deepEqual(
      {
        type: stored.history[0].type,
        status: stored.history[0].status,
        revision: stored.history[0].revision,
      },
      {
        type: 'created',
        status: PACKAGE_STATUS.SENT_TO_UKPBJ,
        revision: 1,
      }
    );
  });

  test('read menolak JSON rusak dan manifest tanpa field wajib', () => {
    const invalidJsonPath = createTemporaryManifestPath();
    fs.writeFileSync(invalidJsonPath, '{invalid');
    assert.throws(
      () => readPackageManifest(invalidJsonPath),
      ManifestValidationError
    );

    assert.throws(
      () => validatePackageManifest({ status: 'SENT_TO_UKPBJ' }),
      /Manifest paket tidak lengkap/
    );
  });

  test('schema v2 menolak history kosong, rusak, atau tidak sinkron', () => {
    assert.throws(() => validatePackageManifest(baseManifest({
      schemaVersion: PACKAGE_MANIFEST_SCHEMA_VERSION,
      revision: 1,
      history: [],
    })), /satu history untuk setiap revision/);

    assert.throws(() => validatePackageManifest(baseManifest({
      schemaVersion: PACKAGE_MANIFEST_SCHEMA_VERSION,
      revision: 1,
      history: null,
    })), ManifestValidationError);

    assert.throws(() => validatePackageManifest(baseManifest({
      schemaVersion: PACKAGE_MANIFEST_SCHEMA_VERSION,
      revision: 1,
      history: [{
        revision: 1,
        type: 'created',
        status: PACKAGE_STATUS.SENT_TO_POKJA,
        at: '2026-08-24T00:00:00.000Z',
        changes: ['status'],
      }],
    })), /status history terakhir/);

    assert.throws(() => validatePackageManifest(baseManifest({
      schemaVersion: PACKAGE_MANIFEST_SCHEMA_VERSION,
      revision: 2,
      history: [{
        revision: 2,
        type: 'created',
        status: PACKAGE_STATUS.SENT_TO_UKPBJ,
        at: '2026-08-24T00:00:00.000Z',
        changes: ['status'],
      }],
    })), /tanpa celah/);
  });

  test('schema v2 menolak metadata history yang tidak dapat diaudit', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(baseManifest(), manifestPath);
    updatePackageManifest(manifestPath, { approvedBy: 'Kepala UKPBJ' });
    const validManifest = readPackageManifest(manifestPath);

    const invalidCases = [
      {
        label: 'type',
        mutate: (manifest) => {
          manifest.history[0].type = 'unknown';
        },
      },
      {
        label: 'timestamp ISO',
        mutate: (manifest) => {
          manifest.history[0].at = 'kemarin';
        },
      },
      {
        label: 'changes',
        mutate: (manifest) => {
          manifest.history[0].changes = 'status';
        },
      },
      {
        label: 'fromStatus',
        mutate: (manifest) => {
          manifest.history[1].fromStatus = PACKAGE_STATUS.SENT_TO_POKJA;
        },
      },
    ];

    for (const { label, mutate } of invalidCases) {
      const invalidManifest = structuredClone(validManifest);
      mutate(invalidManifest);
      assert.throws(
        () => validatePackageManifest(invalidManifest),
        new RegExp(label)
      );
    }
  });

  test('history tidak dapat menyamarkan atau melompati transisi status', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(baseManifest(), manifestPath);
    updatePackageManifest(manifestPath, { approvedBy: 'Kepala UKPBJ' });
    const validManifest = readPackageManifest(manifestPath);

    const disguisedUpdate = structuredClone(validManifest);
    disguisedUpdate.status = PACKAGE_STATUS.SENT_TO_POKJA;
    disguisedUpdate.history[1].status = PACKAGE_STATUS.SENT_TO_POKJA;
    assert.throws(
      () => validatePackageManifest(disguisedUpdate),
      /updated tidak boleh mengubah status/
    );

    const illegalTransition = structuredClone(validManifest);
    illegalTransition.status = PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED;
    Object.assign(illegalTransition.history[1], {
      type: 'transitioned',
      status: PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
      changes: ['approvedBy', 'status'],
    });
    assert.throws(
      () => validatePackageManifest(illegalTransition),
      /Transisi history tidak diizinkan/
    );
  });

  test('read memvalidasi allowedStatuses dan requiredFields tambahan', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(
      baseManifest({ status: 'FLOW7_QUALIFICATION_PROVEN' }),
      manifestPath
    );

    assert.equal(
      readPackageManifest(manifestPath).status,
      'FLOW7_QUALIFICATION_PROVEN'
    );
    assert.throws(
      () => readPackageManifest(manifestPath, {
        allowedStatuses: [
          PACKAGE_STATUS.FLOW6_SUBMISSION_COMPLETED,
        ]
      }),
      /Status manifest tidak diizinkan/
    );
    assert.throws(
      () => readPackageManifest(
        manifestPath,
        { requiredFields: ['packageUrl'] }
      ),
      /packageUrl/
    );
  });

  test('update lama tetap mengembalikan path serta menambah revision/history', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(baseManifest(), manifestPath);

    const result = updatePackageManifest(
      manifestPath,
      { approvedBy: 'Kepala UKPBJ' }
    );
    const stored = readPackageManifest(manifestPath);

    assert.equal(result, manifestPath);
    assert.equal(stored.approvedBy, 'Kepala UKPBJ');
    assert.equal(stored.revision, 2);
    assert.equal(stored.history.length, 2);
    assert.equal(stored.history[1].type, 'updated');
    assert.deepEqual(stored.history[1].changes, ['approvedBy']);
  });

  test('transition melakukan compare-and-set status dan revision', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(baseManifest(), manifestPath);

    const transitioned = transitionPackageManifest(manifestPath, {
      from: PACKAGE_STATUS.SENT_TO_UKPBJ,
      to: PACKAGE_STATUS.SENT_TO_POKJA,
      expectedRevision: 1,
      updates: { approvedBy: 'Kepala UKPBJ' },
      actor: 'qa-automation',
      reason: 'Flow 2 selesai',
    });

    assert.equal(transitioned.status, PACKAGE_STATUS.SENT_TO_POKJA);
    assert.equal(transitioned.revision, 2);
    assert.equal(transitioned.history[1].type, 'transitioned');
    assert.equal(
      transitioned.history[1].fromStatus,
      PACKAGE_STATUS.SENT_TO_UKPBJ
    );
    assert.equal(transitioned.history[1].actor, 'qa-automation');
    assert.equal(transitioned.history[1].reason, 'Flow 2 selesai');
    assert.deepEqual(
      transitioned.history[1].changes,
      ['approvedBy', 'status']
    );
  });

  test('transition menolak status atau revision stale tanpa mengubah file', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(baseManifest(), manifestPath);

    assert.throws(
      () => transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.SENT_TO_POKJA,
        to: PACKAGE_STATUS.POKJA_1_APPROVED,
      }),
      ManifestConflictError
    );
    assert.throws(
      () => transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.SENT_TO_UKPBJ,
        to: PACKAGE_STATUS.SENT_TO_POKJA,
        expectedRevision: 99,
      }),
      ManifestConflictError
    );

    const stored = readPackageManifest(manifestPath);
    assert.equal(stored.status, PACKAGE_STATUS.SENT_TO_UKPBJ);
    assert.equal(stored.revision, 1);
    assert.equal(stored.history.length, 1);
  });

  test('transition menolak lompatan status yang tidak diizinkan', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(baseManifest(), manifestPath);

    assert.throws(
      () => transitionPackageManifest(manifestPath, {
        from: PACKAGE_STATUS.SENT_TO_UKPBJ,
        to: PACKAGE_STATUS.POKJA_APPROVED,
      }),
      ManifestTransitionError
    );
  });

  test('update memigrasikan manifest schema v1 tanpa revision/history', () => {
    const manifestPath = createTemporaryManifestPath();
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        ...baseManifest()
      }, null, 2)
    );

    updatePackageManifest(
      manifestPath,
      { status: PACKAGE_STATUS.SENT_TO_POKJA }
    );
    const stored = readPackageManifest(manifestPath);

    assert.equal(stored.schemaVersion, PACKAGE_MANIFEST_SCHEMA_VERSION);
    assert.equal(stored.revision, 1);
    assert.equal(stored.history.length, 1);
    assert.equal(
      stored.history[0].fromStatus,
      PACKAGE_STATUS.SENT_TO_UKPBJ
    );
    assert.equal(stored.history[0].status, PACKAGE_STATUS.SENT_TO_POKJA);
  });

  test('update kompatibel dengan status Flow setelah Flow 6', () => {
    const manifestPath = createTemporaryManifestPath();
    writePackageManifest(
      baseManifest({ status: 'FLOW7_QUALIFICATION_PROVEN' }),
      manifestPath
    );

    updatePackageManifest(
      manifestPath,
      { status: 'FLOW8_NEGOTIATION_COMPLETED' }
    );
    const stored = readPackageManifest(manifestPath);

    assert.equal(stored.status, 'FLOW8_NEGOTIATION_COMPLETED');
    assert.equal(stored.revision, 2);
    assert.equal(stored.history[1].type, 'transitioned');
  });
});

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  loadActorConfig,
  resolveWorkflowManifestPath,
} from '../config/runtime-config.js';

test('runtime config memuat identitas Penyedia yang dikonfigurasi', () => {
  const actor = loadActorConfig('provider', {
    SPSE_PROVIDER_USERNAME: 'provider@example.test',
    SPSE_PROVIDER_PASSWORD: 'secret',
    SPSE_PROVIDER_DISPLAY_NAME: 'PENYEDIA QA',
  });

  assert.deepEqual(actor, {
    actor: 'provider',
    username: 'provider@example.test',
    password: 'secret',
    displayName: 'PENYEDIA QA',
  });
  assert.equal(Object.isFrozen(actor), true);
});

test('runtime config memakai display name default dan menolak credential kosong', () => {
  const actor = loadActorConfig('pokjaOne', {
    SPSE_POKJA_1_USERNAME: 'pokja@example.test',
    SPSE_POKJA_1_PASSWORD: 'secret',
  });
  assert.equal(actor.displayName, 'Pokja 1');

  assert.throws(() => loadActorConfig('provider', { SPSE_PROVIDER_USERNAME: 'provider@example.test', }), /SPSE_PROVIDER_PASSWORD/);
});

test('runtime config menormalisasi path manifest', () => {
  assert.equal(resolveWorkflowManifestPath({ SPSE_PACKAGE_MANIFEST: './runtime/package.json', }), path.resolve('./runtime/package.json'));
});

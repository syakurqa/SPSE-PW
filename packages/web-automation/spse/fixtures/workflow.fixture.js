import { test as base } from './base.fixture.js';
import { createFlow5Data } from './data/flow5.data.js';
import { createFlow6Data } from './data/flow6.data.js';
import {
  loadActorConfig,
  resolveWorkflowManifestPath,
} from '../config/runtime-config.js';
import { readPackageManifest } from '../utils/package-manifest.js';

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  packageManifest: async ({}, use) => {
    const manifestPath = resolveWorkflowManifestPath();
    await use({
      manifestPath,
      manifest: readPackageManifest(manifestPath),
    });
  },

  // eslint-disable-next-line no-empty-pattern
  providerActor: async ({}, use) => {
    await use(loadActorConfig('provider'));
  },

  // eslint-disable-next-line no-empty-pattern
  pokjaOneActor: async ({}, use) => {
    await use(loadActorConfig('pokjaOne'));
  },

  // eslint-disable-next-line no-empty-pattern
  flow5Scenario: async ({}, use) => {
    await use(createFlow5Data());
  },

  // eslint-disable-next-line no-empty-pattern
  flow6Scenario: async ({}, use) => {
    await use(createFlow6Data());
  },
});

export { expect } from '@playwright/test';

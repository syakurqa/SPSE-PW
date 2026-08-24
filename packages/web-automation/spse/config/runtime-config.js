import path from 'node:path';

const ACTOR_ENVIRONMENT = {
  provider: {
    username: 'SPSE_PROVIDER_USERNAME',
    password: 'SPSE_PROVIDER_PASSWORD',
    displayName: 'SPSE_PROVIDER_DISPLAY_NAME',
    defaultDisplayName: 'ANGSAE BARU',
  },
  pokjaOne: {
    username: 'SPSE_POKJA_1_USERNAME',
    password: 'SPSE_POKJA_1_PASSWORD',
    displayName: 'SPSE_POKJA_1_DISPLAY_NAME',
    defaultDisplayName: 'Pokja 1',
  },
};

function requireEnvironmentValue(environment, name) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} wajib dikonfigurasi di environment.`);
  }
  return value;
}

export function loadActorConfig(actor, environment = process.env) {
  const fieldNames = ACTOR_ENVIRONMENT[actor];
  if (!fieldNames) {
    throw new Error(`Aktor SPSE tidak dikenal: ${actor}.`);
  }
  return Object.freeze({
    actor,
    username: requireEnvironmentValue(environment, fieldNames.username),
    password: requireEnvironmentValue(environment, fieldNames.password),
    displayName: environment[fieldNames.displayName]?.trim()
      || fieldNames.defaultDisplayName,
  });
}

export function resolveWorkflowManifestPath(environment = process.env) {
  const configuredPath = requireEnvironmentValue(
    environment,
    'SPSE_PACKAGE_MANIFEST'
  );
  return path.resolve(configuredPath);
}

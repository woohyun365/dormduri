import { describe, expect, it } from 'vitest';
import { runtimeSecretEnvKeys } from '../environment/env-key.registry.js';
import {
  applyMaterializedSecretsToEnv,
  materializeRequiredSecrets,
} from './secret-materializer.js';
import type { SecretReaderPort } from './secret-reader.port.js';

function allSecretEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const definition of runtimeSecretEnvKeys) {
    env[definition.key] = `${definition.key.toLowerCase()}-value`;
  }
  return env;
}

describe('secret materializer', () => {
  it('materializes direct env secrets keyed by env name', async () => {
    const materialized = await materializeRequiredSecrets({ source: 'env', env: allSecretEnv() });

    expect(Object.keys(materialized)).toEqual(
      runtimeSecretEnvKeys.map((definition) => definition.key),
    );
    expect(materialized.DATABASE_URL).toBe('database_url-value');
    expect(materialized.MIGRATION_DATABASE_URL).toBeUndefined();
  });

  it('materializes AWS secrets by secret-name mapping into env key records', async () => {
    const reader: SecretReaderPort = {
      readSecret: (name) => Promise.resolve(`value-for:${name}`),
      readRequiredSecrets: () => Promise.resolve({}),
    };

    const materialized = await materializeRequiredSecrets({
      source: 'aws-secrets-manager',
      env: { NODE_ENV: 'production' },
      secretNamePrefix: '/knu-roommate/prod/api',
      reader,
    });

    expect(materialized.DATABASE_URL).toBe('value-for:/knu-roommate/prod/api/DATABASE_URL');
  });

  it('applies materialized secrets to a target env object', () => {
    const targetEnv: NodeJS.ProcessEnv = {};

    applyMaterializedSecretsToEnv(targetEnv, { DATABASE_URL: 'postgresql://api:secret@db/api' });

    expect(targetEnv.DATABASE_URL).toBe('postgresql://api:secret@db/api');
  });
});

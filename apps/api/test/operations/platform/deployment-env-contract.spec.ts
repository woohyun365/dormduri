import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ENV_VALIDATION_SCHEMA } from '../../../src/config/composition/api-config.registry.js';
import {
  createApiDeploymentEnvManifest,
  serializeApiDeploymentEnvManifest,
} from '../../../src/config/manifest/deployment-env-manifest.js';

const envExamplePath = resolve(process.cwd(), '../../infra/deploy/.env.api.example');
const migrationEnvExamplePath = resolve(
  process.cwd(),
  '../../infra/deploy/.env.api.migration.example',
);
const lightsailEnvExamplePath = resolve(
  process.cwd(),
  '../../infra/deploy/.env.api.lightsail.example',
);
const secretMountContractPath = resolve(
  process.cwd(),
  '../../infra/deploy/api/secret-mount.contract.json',
);
const manifestPath = resolve(process.cwd(), '../../infra/deploy/api/env.manifest.json');
const entrypointPath = resolve(process.cwd(), '../../infra/deploy/api/entrypoint.sh');

function envKeys(path: string): Set<string> {
  return new Set(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=', 1)[0])
      .filter((key): key is string => key !== undefined && key.length > 0),
  );
}

function envEntries(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

const fakeBase64Key = Buffer.alloc(32, 7).toString('base64');

function fakeSecretValue(key: string): string {
  if (key.endsWith('_BASE64')) {
    return fakeBase64Key;
  }
  if (key.endsWith('DATABASE_URL')) {
    return 'postgresql://example_user:example_password@db.internal:5432/dormduri?schema=public';
  }
  return `example-${key.toLowerCase()}`;
}

// Only placeholders are replaced, so an empty example value still reaches the schema as written.
function fillPlaceholders(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      if (!value.includes('REPLACE_')) {
        return [key, value];
      }
      if (key === 'SES_REGION') {
        return [key, 'ap-northeast-2'];
      }
      if (key === 'SES_FROM_EMAIL') {
        return [key, 'no-reply@example.com'];
      }
      return [key, fakeSecretValue(key)];
    }),
  );
}

function mountedSecretEnv(): Record<string, string> {
  const contract = JSON.parse(readFileSync(secretMountContractPath, 'utf8')) as {
    requiredFiles: string[];
  };
  return Object.fromEntries(contract.requiredFiles.map((key) => [key, fakeSecretValue(key)]));
}

function envValidationMessages(env: Record<string, string>): string[] {
  const { error } = API_ENV_VALIDATION_SCHEMA.validate(env, { abortEarly: false });
  return error?.details.map((detail) => detail.message) ?? [];
}

describe('API deployment env examples', () => {
  it.each([
    ['runtime', envExamplePath, () => ({})],
    ['Lightsail', lightsailEnvExamplePath, mountedSecretEnv],
  ] as const)('%s example passes the API env schema as written', (_name, path, mountedEnv) => {
    const example = envEntries(path);

    expect(envValidationMessages({ ...mountedEnv(), ...fillPlaceholders(example) })).toEqual([]);
    expect(example.SES_FROM_NAME).toBe('돔두리');
    expect(example.SES_CONFIGURATION_SET).toBe('dormduri-production');
  });
});

describe('API deployment env artifact', () => {
  it('keeps the generated manifest fresh and value-free', () => {
    const expected = serializeApiDeploymentEnvManifest(createApiDeploymentEnvManifest());
    const actual = readFileSync(manifestPath, 'utf8');

    expect(actual).toBe(expected);
    expect(actual).not.toContain('REPLACE_ME');
    expect(actual).not.toContain('postgresql://');
  });

  it('documents runtime and migration requirements in separate templates', () => {
    const manifest = createApiDeploymentEnvManifest();
    const runtimeExampleKeys = envKeys(envExamplePath);
    const migrationExampleKeys = envKeys(migrationEnvExamplePath);

    expect(
      manifest.projections.containerStartupRequired.filter((key) => !runtimeExampleKeys.has(key)),
    ).toEqual([]);
    expect(
      manifest.projections.migrationRequired.filter((key) => !migrationExampleKeys.has(key)),
    ).toEqual([]);
    expect(runtimeExampleKeys.has('MIGRATION_DATABASE_URL')).toBe(false);
    expect(runtimeExampleKeys.has('DIRECT_URL')).toBe(false);
  });

  it('boots from runtime projection without migration credentials and reports only missing keys', () => {
    const manifest = createApiDeploymentEnvManifest();
    const runtimeEnv = Object.fromEntries(
      manifest.projections.containerStartupRequired.map((key) => [key, 'private-value']),
    );
    const success = spawnSync('sh', [entrypointPath, 'sh', '-c', 'exit 0'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...runtimeEnv,
        SECRET_SOURCE: 'env',
        API_ENV_MANIFEST_PATH: manifestPath,
      },
    });

    expect(success.status).toBe(0);

    const [missingKey, ...remainingKeys] = manifest.projections.containerStartupRequired;
    expect(missingKey).toBeDefined();
    const failure = spawnSync('sh', [entrypointPath, 'sh', '-c', 'exit 0'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...Object.fromEntries(remainingKeys.map((key) => [key, 'private-value'])),
        SECRET_SOURCE: 'env',
        API_ENV_MANIFEST_PATH: manifestPath,
      },
    });

    expect(failure.status).toBe(64);
    expect(failure.stderr).toContain(`missing required env: ${missingKey}`);
    expect(failure.stderr).not.toContain('private-value');
  });

  it('lets the application materialize AWS-owned secrets while requiring public bootstrap input', () => {
    const manifest = createApiDeploymentEnvManifest();
    const secretKeys = new Set(
      manifest.entries.filter((entry) => entry.secret).map((entry) => entry.key),
    );
    const publicRuntimeEnv = Object.fromEntries(
      manifest.projections.containerStartupRequired
        .filter((key) => !secretKeys.has(key))
        .map((key) => [key, 'public-runtime-value']),
    );
    const success = spawnSync('sh', [entrypointPath, 'sh', '-c', 'exit 0'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...publicRuntimeEnv,
        SECRET_SOURCE: 'aws-secrets-manager',
        SECRET_NAME_PREFIX: '/dormduri/production/api',
        API_ENV_MANIFEST_PATH: manifestPath,
      },
    });

    expect(success.status).toBe(0);

    const missingPrefix = spawnSync('sh', [entrypointPath, 'sh', '-c', 'exit 0'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...publicRuntimeEnv,
        SECRET_SOURCE: 'aws-secrets-manager',
        SECRET_NAME_PREFIX: '',
        API_ENV_MANIFEST_PATH: manifestPath,
      },
    });

    expect(missingPrefix.status).toBe(64);
    expect(missingPrefix.stderr).toContain('missing required env: SECRET_NAME_PREFIX');
  });
});
import { spawnSync } from 'node:child_process';

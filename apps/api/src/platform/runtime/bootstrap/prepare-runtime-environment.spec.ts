import { describe, expect, it } from 'vitest';
import { envValidationSchema } from '../../../config/environment/env.validation.js';
import type { SecretReaderPort } from '../../../config/secrets/secret-reader.port.js';
import {
  describeRuntimeEnvironmentPreparationFailure,
  parseRuntimeBootstrapEnvironment,
  prepareRuntimeEnvironment,
} from './prepare-runtime-environment.js';
import {
  clearRuntimeBootstrapReceipt,
  readRuntimeBootstrapReceipt,
} from './runtime-bootstrap-receipt.js';

const validBase64Key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

describe('prepareRuntimeEnvironment', () => {
  it('parses only the public bootstrap selectors before secret materialization', () => {
    expect(
      parseRuntimeBootstrapEnvironment({
        NODE_ENV: 'test',
        SECRET_SOURCE: 'aws-secrets-manager',
        SECRET_NAME_PREFIX: '/knu-roommate/test/api/',
      }),
    ).toEqual({
      nodeEnv: 'test',
      secretSource: 'aws-secrets-manager',
      secretNamePrefix: '/knu-roommate/test/api',
    });
  });

  it('rejects a production AWS source without a configured prefix', () => {
    expect(() =>
      parseRuntimeBootstrapEnvironment({
        NODE_ENV: 'production',
        SECRET_SOURCE: 'aws-secrets-manager',
      }),
    ).toThrow(expect.objectContaining({ code: 'BOOTSTRAP_ENV_INVALID' }));
  });

  it('materializes fake AWS secrets before full config validation and records no secret data', async () => {
    clearRuntimeBootstrapReceipt();
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      SECRET_SOURCE: 'aws-secrets-manager',
      SECRET_NAME_PREFIX: '/knu-roommate/production/api',
      EMAIL_PROVIDER: 'ses',
      SES_REGION: 'ap-northeast-2',
      SES_FROM_EMAIL: 'no-reply@example.com',
    };
    const reader = fakeAwsReader();

    const receipt = await prepareRuntimeEnvironment(env, {
      reader,
      now: () => new Date('2026-08-12T05:30:00.000Z'),
    });
    const validation = envValidationSchema.validate(env, { abortEarly: false });
    const serializedReceipt = JSON.stringify(receipt);

    expect(validation.error).toBeUndefined();
    expect(env.DATABASE_URL).toBe('postgresql://api:password@db.internal:5432/api');
    expect(receipt).toEqual({
      version: 1,
      status: 'prepared',
      secretSource: 'aws-secrets-manager',
      materializedSecretCount: 13,
      completedAt: '2026-08-12T05:30:00.000Z',
    });
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(readRuntimeBootstrapReceipt()).toBe(receipt);
    expect(serializedReceipt).not.toContain('DATABASE_URL');
    expect(serializedReceipt).not.toContain('password');
    expect(serializedReceipt).not.toContain('/knu-roommate/production/api');
  });

  it('keeps local env preparation compatible with validation defaults', async () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', SECRET_SOURCE: 'env' };

    const receipt = await prepareRuntimeEnvironment(env);
    const validation = envValidationSchema.validate(env, { abortEarly: false });

    expect(receipt.materializedSecretCount).toBe(0);
    expect(validation.error).toBeUndefined();
  });

  it('maps missing production env secrets to a bounded failure', async () => {
    const error = await prepareRuntimeEnvironment({
      NODE_ENV: 'production',
      SECRET_SOURCE: 'env',
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'SECRET_MATERIALIZATION_FAILED' });
    expect(describeRuntimeEnvironmentPreparationFailure(error)).toEqual({
      code: 'SECRET_MATERIALIZATION_FAILED',
      message: 'API secret materialization failed.',
    });
    expect((error as Error).message).not.toContain('DATABASE_URL');
  });

  it('bounds a reader that does not complete', async () => {
    const reader: SecretReaderPort = {
      readSecret: () => new Promise<string>(() => undefined),
      readRequiredSecrets: () => new Promise<Record<string, string>>(() => undefined),
    };

    await expect(
      prepareRuntimeEnvironment(productionAwsEnvironment(), { reader, timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: 'SECRET_MATERIALIZATION_TIMEOUT' });
  });

  it('does not expose provider payloads through the bootstrap failure description', async () => {
    const reader: SecretReaderPort = {
      readSecret: () => Promise.reject(new Error('AWS payload contains raw-secret-value')),
      readRequiredSecrets: () => Promise.resolve({}),
    };
    const error = await prepareRuntimeEnvironment(productionAwsEnvironment(), { reader }).catch(
      (caught: unknown) => caught,
    );
    const failure = describeRuntimeEnvironmentPreparationFailure(error);

    expect(failure).toEqual({
      code: 'SECRET_MATERIALIZATION_FAILED',
      message: 'API secret materialization failed.',
    });
    expect(JSON.stringify(failure)).not.toContain('raw-secret-value');
  });
});

function productionAwsEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    SECRET_SOURCE: 'aws-secrets-manager',
    SECRET_NAME_PREFIX: '/knu-roommate/production/api',
    EMAIL_PROVIDER: 'ses',
    SES_REGION: 'ap-northeast-2',
    SES_FROM_EMAIL: 'no-reply@example.com',
  };
}

function fakeAwsReader(): SecretReaderPort {
  return {
    readSecret: (secretName) => Promise.resolve(validSecretValue(secretName)),
    readRequiredSecrets: () => Promise.resolve({}),
  };
}

function validSecretValue(secretName: string): string {
  const envKey = secretName.split('/').at(-1);
  switch (envKey) {
    case 'DATABASE_URL':
      return 'postgresql://api:password@db.internal:5432/api';
    case 'RETENTION_WORKER_DATABASE_URL':
      return 'postgresql://retention_worker:password@db.internal:5432/api';
    case 'RETENTION_DISCLOSURE_DATABASE_URL':
      return 'postgresql://retention_disclosure:password@db.internal:5432/api';
    case 'AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64':
    case 'RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64':
    case 'RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64':
      return validBase64Key;
    default:
      return `production-${envKey?.toLowerCase() ?? 'secret'}-value`;
  }
}

import {
  GetSecretValueCommand,
  type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import { describe, expect, it, vi } from 'vitest';
import {
  AwsSecretsManagerSecretReader,
  mapAwsSecretsManagerErrorCode,
  type SecretsManagerClientLike,
} from './aws-secrets-manager-secret-reader.js';
import { SecretReadError } from '../secret-reader.port.js';

function fakeClient(output: GetSecretValueCommandOutput): SecretsManagerClientLike {
  return {
    send: vi.fn((command: GetSecretValueCommand) => {
      expect(command).toBeInstanceOf(GetSecretValueCommand);
      return Promise.resolve(output);
    }),
  };
}

function throwingClient(error: Error): SecretsManagerClientLike {
  return {
    send: vi.fn(() => Promise.reject(error)),
  };
}

describe('AwsSecretsManagerSecretReader', () => {
  it('reads SecretString values through GetSecretValueCommand', async () => {
    const client = fakeClient({ SecretString: 'secret-value', $metadata: {} });
    const reader = new AwsSecretsManagerSecretReader({ client });

    await expect(reader.readSecret('/knu-roommate/prod/api/DATABASE_URL')).resolves.toBe(
      'secret-value',
    );
  });

  it('rejects SecretBinary with an explicit bounded category', async () => {
    const reader = new AwsSecretsManagerSecretReader({
      client: fakeClient({ SecretBinary: new Uint8Array([1, 2, 3]), $metadata: {} }),
    });

    await expect(reader.readSecret('/secret')).rejects.toMatchObject({
      name: 'SecretReadError',
      source: 'aws-secrets-manager',
      code: 'UNSUPPORTED_BINARY',
    });
  });

  it('treats a missing SecretString and SecretBinary as missing', async () => {
    const reader = new AwsSecretsManagerSecretReader({ client: fakeClient({ $metadata: {} }) });

    await expect(reader.readSecret('/secret')).rejects.toMatchObject({ code: 'MISSING' });
  });

  it('maps AWS errors to bounded categories without exposing raw AWS messages', async () => {
    const awsError = Object.assign(new Error('Access denied to super-secret-value'), {
      name: 'AccessDeniedException',
    });
    const reader = new AwsSecretsManagerSecretReader({ client: throwingClient(awsError) });
    const error = await reader.readSecret('/secret').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SecretReadError);
    expect(error).toMatchObject({ code: 'ACCESS_DENIED', secretName: '/secret' });
    expect((error as Error).message).not.toContain('super-secret-value');
  });

  it('maps throttled and decryption errors separately', () => {
    expect(mapAwsSecretsManagerErrorCode({ name: 'ThrottlingException' })).toBe('THROTTLED');
    expect(mapAwsSecretsManagerErrorCode({ name: 'DecryptionFailureException' })).toBe(
      'DECRYPTION_FAILURE',
    );
    expect(mapAwsSecretsManagerErrorCode({ name: 'ServiceUnavailableException' })).toBe(
      'TRANSIENT',
    );
    expect(mapAwsSecretsManagerErrorCode({ name: 'Unexpected' })).toBe('UNKNOWN');
  });
});

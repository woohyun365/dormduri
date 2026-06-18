import { describe, expect, it } from 'vitest';
import { EnvSecretReader } from './env-secret-reader.js';
import { SecretReadError } from './secret-reader.port.js';

describe('EnvSecretReader', () => {
  it('reads required secrets from the provided env object', async () => {
    const reader = new EnvSecretReader({ DATABASE_URL: 'postgresql://api:secret@db/api' });

    await expect(reader.readSecret('DATABASE_URL')).resolves.toBe('postgresql://api:secret@db/api');
  });

  it('fails missing or blank secrets with a bounded error', async () => {
    const reader = new EnvSecretReader({ DATABASE_URL: '   ' });

    await expect(reader.readSecret('DATABASE_URL')).rejects.toMatchObject({
      name: 'SecretReadError',
      source: 'env',
      secretName: 'DATABASE_URL',
      code: 'MISSING',
    });
  });

  it('reads multiple required secrets without logging values', async () => {
    const reader = new EnvSecretReader({ FIRST_SECRET: 'one', SECOND_SECRET: 'two' });

    await expect(reader.readRequiredSecrets(['FIRST_SECRET', 'SECOND_SECRET'])).resolves.toEqual({
      FIRST_SECRET: 'one',
      SECOND_SECRET: 'two',
    });
  });

  it('does not include raw secret values in failure messages', async () => {
    const reader = new EnvSecretReader({ SECRET_VALUE: 'raw-secret' });
    const error = await reader.readSecret('MISSING_SECRET').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SecretReadError);
    expect((error as Error).message).not.toContain('raw-secret');
  });
});

import { describe, expect, it } from 'vitest';
import secretSourceConfig, { readSecretSource } from './secret-source.config.js';

describe('secretSourceConfig', () => {
  it('defaults to direct env materialization', () => {
    expect(readSecretSource({})).toBe('env');
  });

  it('accepts the future Secrets Manager materialization selector', () => {
    expect(readSecretSource({ SECRET_SOURCE: 'aws-secrets-manager' })).toBe('aws-secrets-manager');
  });

  it('rejects unsupported secret sources', () => {
    expect(() => readSecretSource({ SECRET_SOURCE: 'local-file' })).toThrow(/SECRET_SOURCE/);
  });

  it('exposes the selected source through the Nest config namespace', () => {
    const previousEnv = { ...process.env };
    process.env.SECRET_SOURCE = 'aws-secrets-manager';

    try {
      expect(secretSourceConfig()).toEqual({ source: 'aws-secrets-manager' });
    } finally {
      process.env = previousEnv;
    }
  });
});

import { describe, expect, it } from 'vitest';
import { runtimeSecretEnvKeys } from '../environment/env-key.registry.js';
import {
  defaultSecretNamePrefixForEnv,
  listSecretNameMappings,
  normalizeSecretNamePrefix,
  secretEnvKeyNames,
  secretNameForEnvKey,
} from './secret-name-registry.js';

describe('secret name registry', () => {
  it('tracks every env key registered as secret', () => {
    expect(secretEnvKeyNames).toEqual(runtimeSecretEnvKeys.map((definition) => definition.key));
    expect(secretEnvKeyNames).toContain('DATABASE_URL');
    expect(secretEnvKeyNames).toContain('VERIFICATION_CODE_HMAC_SECRET');
    expect(secretEnvKeyNames).toContain('AUTH_PERSISTENCE_HMAC_SECRET');
    expect(secretEnvKeyNames).toContain('AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64');
  });

  it('builds the default production convention from NODE_ENV and env key', () => {
    expect(secretNameForEnvKey('DATABASE_URL', { nodeEnv: 'production' })).toBe(
      '/dormduri/production/api/DATABASE_URL',
    );
  });

  it('normalizes explicit prefixes and maps all secret env keys', () => {
    expect(normalizeSecretNamePrefix('/dormduri/prod/api/')).toBe('/dormduri/prod/api');

    const mappings = listSecretNameMappings({ prefix: '/dormduri/prod/api/' });
    expect(mappings).toHaveLength(runtimeSecretEnvKeys.length);
    expect(mappings.find((mapping) => mapping.envKey === 'DATABASE_URL')).toEqual({
      envKey: 'DATABASE_URL',
      secretName: '/dormduri/prod/api/DATABASE_URL',
    });
  });

  it('rejects non-secret env keys and invalid prefixes', () => {
    expect(() => secretNameForEnvKey('PORT')).toThrow(/not registered/);
    expect(() => normalizeSecretNamePrefix('dormduri/prod/api')).toThrow(/must start/);
    expect(() => normalizeSecretNamePrefix('/dormduri//prod')).toThrow(/empty path/);
  });

  it('rejects unsupported NODE_ENV path segments', () => {
    expect(() => defaultSecretNamePrefixForEnv('prod/staging')).toThrow(/unsupported/);
  });
});

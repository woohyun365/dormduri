import { describe, expect, it } from 'vitest';
import { secretEnvKeys } from '../env-keys/index.js';
import {
  defaultSecretNamePrefixForEnv,
  listSecretNameMappings,
  normalizeSecretNamePrefix,
  secretEnvKeyNames,
  secretNameForEnvKey,
} from './secret-name-registry.js';

describe('secret name registry', () => {
  it('tracks every env key registered as secret', () => {
    expect(secretEnvKeyNames).toEqual(secretEnvKeys.map((definition) => definition.key));
    expect(secretEnvKeyNames).toContain('DATABASE_URL');
    expect(secretEnvKeyNames).toContain('VERIFICATION_CODE_HMAC_SECRET');
    expect(secretEnvKeyNames).toContain('AUTH_PERSISTENCE_HMAC_SECRET');
    expect(secretEnvKeyNames).toContain('AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64');
  });

  it('builds the default production convention from NODE_ENV and env key', () => {
    expect(secretNameForEnvKey('DATABASE_URL', { nodeEnv: 'production' })).toBe(
      '/knu-roommate/production/api/DATABASE_URL',
    );
  });

  it('normalizes explicit prefixes and maps all secret env keys', () => {
    expect(normalizeSecretNamePrefix('/knu-roommate/prod/api/')).toBe('/knu-roommate/prod/api');

    const mappings = listSecretNameMappings({ prefix: '/knu-roommate/prod/api/' });
    expect(mappings).toHaveLength(secretEnvKeys.length);
    expect(mappings.find((mapping) => mapping.envKey === 'DATABASE_URL')).toEqual({
      envKey: 'DATABASE_URL',
      secretName: '/knu-roommate/prod/api/DATABASE_URL',
    });
  });

  it('rejects non-secret env keys and invalid prefixes', () => {
    expect(() => secretNameForEnvKey('PORT')).toThrow(/not registered/);
    expect(() => normalizeSecretNamePrefix('knu-roommate/prod/api')).toThrow(/must start/);
    expect(() => normalizeSecretNamePrefix('/knu-roommate//prod')).toThrow(/empty path/);
  });

  it('rejects unsupported NODE_ENV path segments', () => {
    expect(() => defaultSecretNamePrefixForEnv('prod/staging')).toThrow(/unsupported/);
  });
});

import { describe, expect, it } from 'vitest';
import secretSourceConfig, {
  readSecretNamePrefix,
  readSecretMountDirectory,
  readSecretSource,
} from './secret-source.config.js';
import { SECRET_NAME_PREFIX_ENV } from '../../config/secrets/secret-name-prefix.constants.js';

const previousEnvSnapshot = { ...process.env };

describe('secretSourceConfig', () => {
  it('defaults to direct env materialization', () => {
    expect(readSecretSource({})).toBe('env');
  });

  it('accepts the Secrets Manager materialization selector', () => {
    expect(readSecretSource({ SECRET_SOURCE: 'aws-secrets-manager' })).toBe('aws-secrets-manager');
  });

  it('accepts a mounted-file selector and reads its public directory', () => {
    expect(readSecretSource({ SECRET_SOURCE: 'mounted-files' })).toBe('mounted-files');
    expect(readSecretMountDirectory({ SECRET_MOUNT_DIRECTORY: ' /run/secrets/api ' })).toBe(
      '/run/secrets/api',
    );
  });

  it('rejects unsupported secret sources', () => {
    expect(() => readSecretSource({ SECRET_SOURCE: 'local-file' })).toThrow(/SECRET_SOURCE/);
  });

  it('reads an optional Secrets Manager name prefix without inventing a default', () => {
    expect(readSecretNamePrefix({})).toBeNull();
    expect(readSecretNamePrefix({ [SECRET_NAME_PREFIX_ENV]: ' /knu-roommate/prod/api ' })).toBe(
      '/knu-roommate/prod/api',
    );
  });

  it('exposes the selected source and prefix through the Nest config namespace', () => {
    process.env.SECRET_SOURCE = 'aws-secrets-manager';
    process.env[SECRET_NAME_PREFIX_ENV] = '/knu-roommate/production/api';

    try {
      expect(secretSourceConfig()).toEqual({
        source: 'aws-secrets-manager',
        secretMountDirectory: null,
        secretNamePrefix: '/knu-roommate/production/api',
      });
    } finally {
      process.env = { ...previousEnvSnapshot };
    }
  });
});

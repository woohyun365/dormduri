import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BackofficeSettingsError, loadBackofficeSettings } from './backoffice-settings.js';

const base = {
  BACKOFFICE_DATABASE_URL: 'postgresql://dormduri_backoffice:pw@db:5432/dormduri',
  BACKOFFICE_RETENTION_DATABASE_URL:
    'postgresql://dormduri_backoffice_retention:pw@db:5432/dormduri',
  BACKOFFICE_TOTP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};

describe('backoffice settings', () => {
  it('reads the database URLs, pools and the 32-byte TOTP key', () => {
    const settings = loadBackofficeSettings({ ...base, NODE_ENV: 'test' });
    expect(settings.database.runtimePoolMax).toBe(5);
    expect(settings.database.retentionPoolMax).toBe(1);
    expect(settings.totpEncryptionKey).toHaveLength(32);
    expect(settings.retentionJob).toEqual({ enabled: false, intervalMs: 3_600_000 });
  });

  it('runs the cleanup job by default in production, which also needs the metrics token', () => {
    expect(() => loadBackofficeSettings({ ...base, NODE_ENV: 'production' })).toThrow(
      BackofficeSettingsError,
    );
    const settings = loadBackofficeSettings({
      ...base,
      NODE_ENV: 'production',
      BACKOFFICE_METRICS_BEARER_TOKEN: 'm'.repeat(32),
    });
    expect(settings.retentionJob.enabled).toBe(true);
  });

  it('refuses one URL for both LOGIN users and a key of another length, naming fields only', () => {
    const rejected = (env: Record<string, string>) => {
      try {
        loadBackofficeSettings(env);
      } catch (error) {
        expect(error).toBeInstanceOf(BackofficeSettingsError);
        return (error as Error).message;
      }
      throw new Error('settings were accepted');
    };
    const sameUrl = rejected({
      ...base,
      BACKOFFICE_RETENTION_DATABASE_URL: base.BACKOFFICE_DATABASE_URL,
    });
    expect(sameUrl).toContain('BACKOFFICE_RETENTION_DATABASE_URL');
    expect(sameUrl).not.toContain('pw@');
    expect(
      rejected({ ...base, BACKOFFICE_TOTP_ENCRYPTION_KEY: randomBytes(16).toString('base64') }),
    ).toContain('BACKOFFICE_TOTP_ENCRYPTION_KEY');
  });
});

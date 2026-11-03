import { describe, expect, it } from 'vitest';
import { runtimeSecretEnvKeys } from '../environment/env-key.registry.js';
import { SECRET_NAME_PREFIX_ENV } from './secret-name-prefix.constants.js';
import { buildSecretInventory, formatSecretInventoryReport } from './secret-inventory.js';

describe('secret inventory dry-run', () => {
  it('lists secret env keys without exposing direct env values', () => {
    const report = buildSecretInventory({
      source: 'env',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://api:raw-password@db.internal/api',
      },
    });
    const formatted = formatSecretInventoryReport(report);

    expect(report.items).toHaveLength(runtimeSecretEnvKeys.length);
    expect(formatted).toContain('DATABASE_URL owner=platform-database category=database');
    expect(formatted).toContain('values=not printed');
    expect(formatted).not.toContain('raw-password');
    expect(formatted).not.toContain('postgresql://');
  });

  it('lists Secrets Manager names for the configured prefix without reading values', () => {
    const report = buildSecretInventory({
      env: {
        NODE_ENV: 'production',
        SECRET_SOURCE: 'aws-secrets-manager',
        [SECRET_NAME_PREFIX_ENV]: '/dormduri/prod/api',
        DATABASE_URL: 'should-not-appear',
      },
    });

    expect(report.source).toBe('aws-secrets-manager');
    expect(report.secretNamePrefix).toBe('/dormduri/prod/api');
    expect(report.items.find((item) => item.envKey === 'DATABASE_URL')).toEqual({
      envKey: 'DATABASE_URL',
      owner: 'platform-database',
      category: 'database',
      secretName: '/dormduri/prod/api/DATABASE_URL',
    });
    expect(formatSecretInventoryReport(report)).not.toContain('should-not-appear');
  });
});

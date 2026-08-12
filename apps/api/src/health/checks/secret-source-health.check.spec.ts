import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { runtimeSecretEnvKeys } from '../../config/environment/env-key.registry.js';
import { SecretSourceHealthCheck } from './secret-source-health.check.js';

const previousEnv = { ...process.env };

describe('SecretSourceHealthCheck', () => {
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T03:00:00.000Z'));
    process.env = { ...previousEnv };
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    process.env = { ...previousEnv };
  });

  it('non-production에서는 secret materialization을 readiness blocker로 삼지 않는다', async () => {
    const check = new SecretSourceHealthCheck(
      { isProduction: false, nodeEnv: 'test', port: 4000 },
      { source: 'env', secretMountDirectory: null, secretNamePrefix: null },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'secretSource',
      status: 'up',
      code: 'SECRET_SOURCE_VALID',
    });
  });

  it('production에서는 required secret env가 모두 materialized 되어야 한다', async () => {
    process.env = Object.fromEntries(runtimeSecretEnvKeys.map(({ key }) => [key, 'secret-value']));
    const check = new SecretSourceHealthCheck(
      { isProduction: true, nodeEnv: 'production', port: 4000 },
      { source: 'env', secretMountDirectory: null, secretNamePrefix: null },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'secretSource',
      status: 'up',
      code: 'SECRET_SOURCE_VALID',
    });
  });

  it('production secret 누락은 raw value 없이 invalid로 반환한다', async () => {
    process.env = {};
    const check = new SecretSourceHealthCheck(
      { isProduction: true, nodeEnv: 'production', port: 4000 },
      { source: 'env', secretMountDirectory: null, secretNamePrefix: null },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'secretSource',
      status: 'down',
      code: 'SECRET_SOURCE_INVALID',
    });
  });

  it('production Secrets Manager source는 prefix가 필요하다', async () => {
    process.env = Object.fromEntries(runtimeSecretEnvKeys.map(({ key }) => [key, 'secret-value']));
    const check = new SecretSourceHealthCheck(
      { isProduction: true, nodeEnv: 'production', port: 4000 },
      { source: 'aws-secrets-manager', secretMountDirectory: null, secretNamePrefix: null },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'secretSource',
      status: 'down',
      code: 'SECRET_SOURCE_INVALID',
    });
  });
});

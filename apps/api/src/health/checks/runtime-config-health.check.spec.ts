import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { RuntimeConfigHealthCheck } from './runtime-config-health.check.js';

const previousEnv = { ...process.env };

describe('RuntimeConfigHealthCheck', () => {
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T03:00:00.000Z'));
    process.env = { NODE_ENV: 'test' };
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    process.env = { ...previousEnv };
  });

  it('local/test default config는 valid로 본다', async () => {
    const check = new RuntimeConfigHealthCheck();

    await expect(check.check()).resolves.toMatchObject({
      name: 'runtimeConfig',
      status: 'up',
      code: 'RUNTIME_CONFIG_VALID',
    });
  });

  it('production required config 누락은 bounded invalid code로 축약한다', async () => {
    process.env = { NODE_ENV: 'production' };
    const check = new RuntimeConfigHealthCheck();

    await expect(check.check()).resolves.toMatchObject({
      name: 'runtimeConfig',
      status: 'down',
      code: 'RUNTIME_CONFIG_INVALID',
    });
  });
});

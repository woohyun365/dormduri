import { describe, expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { AuthLoginMetricsService } from '../login-attempts/auth-login-metrics.service.js';
import { AuthPasswordHashPolicy } from './auth-password-hash.adapter.js';
import {
  AUTH_LOGIN_CANONICAL_DUMMY_HASH,
  AUTH_PASSWORD_HASH_OPTIONS,
  hashPassword,
} from './password-hash.js';

describe('AuthPasswordHashPolicy', () => {
  it('canonical dummy hash는 active password hash와 같은 Argon2id profile을 사용한다', async () => {
    const activeHash = await hashPassword('Pass1234');
    const expectedProfile = `m=${AUTH_PASSWORD_HASH_OPTIONS.memoryCost},t=${AUTH_PASSWORD_HASH_OPTIONS.timeCost},p=${AUTH_PASSWORD_HASH_OPTIONS.parallelism}`;

    expect(activeHash).toContain(`$argon2id$v=19$${expectedProfile}$`);
    expect(AUTH_LOGIN_CANONICAL_DUMMY_HASH).toContain(`$argon2id$v=19$${expectedProfile}$`);
  });

  it('real/dummy verification을 같은 observer 경계로 기록한다', async () => {
    const metrics = new AuthLoginMetricsService();
    const startPasswordVerify = vi.spyOn(metrics, 'startPasswordVerify');
    const policy = new AuthPasswordHashPolicy(metrics);
    const activeHash = await hashPassword('Pass1234');

    await expect(policy.verifyLoginPassword(activeHash, 'WrongPass1234')).resolves.toBe(false);
    await expect(policy.verifyUnavailableLogin('WrongPass1234')).resolves.toBeUndefined();

    expect(startPasswordVerify).toHaveBeenNthCalledWith(1, 'real');
    expect(startPasswordVerify).toHaveBeenNthCalledWith(2, 'dummy');
  });

  it('real/dummy verify smoke에서 hash 연산이 생략되는 큰 timing discrepancy가 없다', async () => {
    const policy = new AuthPasswordHashPolicy(new AuthLoginMetricsService());
    const activeHash = await hashPassword('Pass1234');
    const measure = async (operation: () => Promise<unknown>) => {
      const startedAt = performance.now();
      await operation();
      return performance.now() - startedAt;
    };
    const realDurations: number[] = [];
    const dummyDurations: number[] = [];

    for (let index = 0; index < 3; index += 1) {
      realDurations.push(
        await measure(() => policy.verifyLoginPassword(activeHash, 'WrongPass1234')),
      );
      dummyDurations.push(await measure(() => policy.verifyUnavailableLogin('WrongPass1234')));
    }

    const average = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length;
    const ratio =
      Math.max(average(realDurations), average(dummyDurations)) /
      Math.max(1, Math.min(average(realDurations), average(dummyDurations)));

    expect(ratio).toBeLessThan(5);
  });
});

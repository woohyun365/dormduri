import { describe, expect, it } from 'vitest';
import { isLocked, LOCKOUT_THRESHOLD, shouldLock } from './lockout-policy.js';
import { LOGIN_ATTEMPTS_PER_MINUTE, LoginRateLimiter } from './login-rate-limit.js';

describe('login limits', () => {
  it('locks on the fifth consecutive failure (OA-R5)', () => {
    expect(LOCKOUT_THRESHOLD).toBe(5);
    expect(shouldLock(4)).toBe(false);
    expect(shouldLock(5)).toBe(true);
    const now = new Date('2026-11-21T00:00:00.000Z');
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked(new Date(now.getTime() + 1), now)).toBe(true);
    expect(isLocked(now, now)).toBe(false);
  });

  it('admits 30 unauthenticated attempts per minute for the whole process', () => {
    let now = 0;
    const limiter = new LoginRateLimiter(LOGIN_ATTEMPTS_PER_MINUTE, () => now);
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_MINUTE; attempt += 1) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.tryAcquire()).toBe(false);
    now = 60_000;
    expect(limiter.tryAcquire()).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  evaluateSession,
  isRecentlyReauthenticated,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from './session-policy.js';

const START = new Date('2026-11-21T09:00:00.000Z');
const at = (ms: number) => new Date(START.getTime() + ms);

describe('session policy (OA-R3, OA-R4)', () => {
  const fresh = {
    lastActivityAt: START,
    absoluteExpiresAt: at(SESSION_ABSOLUTE_TIMEOUT_MS),
    revokedAt: null,
  };

  it('ends a session after 15 idle minutes', () => {
    expect(evaluateSession(fresh, at(SESSION_IDLE_TIMEOUT_MS - 1))).toBe('active');
    expect(evaluateSession(fresh, at(SESSION_IDLE_TIMEOUT_MS))).toBe('idle_expired');
  });

  it('ends a session 8 hours after login even while active', () => {
    const busy = { ...fresh, lastActivityAt: at(SESSION_ABSOLUTE_TIMEOUT_MS - 60_000) };
    expect(evaluateSession(busy, at(SESSION_ABSOLUTE_TIMEOUT_MS - 1))).toBe('active');
    expect(evaluateSession(busy, at(SESSION_ABSOLUTE_TIMEOUT_MS))).toBe('absolute_expired');
  });

  it('keeps a revoked session revoked', () => {
    expect(evaluateSession({ ...fresh, revokedAt: START }, START)).toBe('revoked');
  });

  it('counts a re-authentication for five minutes', () => {
    expect(isRecentlyReauthenticated(null, START)).toBe(false);
    expect(isRecentlyReauthenticated(START, at(5 * 60_000 - 1))).toBe(true);
    expect(isRecentlyReauthenticated(START, at(5 * 60_000))).toBe(false);
    expect(isRecentlyReauthenticated(at(60_000), START)).toBe(false);
  });
});

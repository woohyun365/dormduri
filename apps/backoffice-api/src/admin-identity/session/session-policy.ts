import { HOUR_MS, MINUTE_MS } from '../../platform/time/clock.js';

/** OA-R3 and OA-R4 values (operator-access.md). */
export const SESSION_IDLE_TIMEOUT_MS = 15 * MINUTE_MS;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * HOUR_MS;
export const REAUTHENTICATION_WINDOW_MS = 5 * MINUTE_MS;

export interface SessionTimes {
  readonly lastActivityAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

export type SessionState = 'active' | 'revoked' | 'idle_expired' | 'absolute_expired';

/** A revoked session stays revoked; then the absolute limit, then the idle limit. */
export function evaluateSession(session: SessionTimes, now: Date): SessionState {
  if (session.revokedAt !== null) {
    return 'revoked';
  }
  if (now.getTime() >= session.absoluteExpiresAt.getTime()) {
    return 'absolute_expired';
  }
  if (now.getTime() - session.lastActivityAt.getTime() >= SESSION_IDLE_TIMEOUT_MS) {
    return 'idle_expired';
  }
  return 'active';
}

export function isRecentlyReauthenticated(reauthenticatedAt: Date | null, now: Date): boolean {
  return (
    reauthenticatedAt !== null &&
    now.getTime() - reauthenticatedAt.getTime() < REAUTHENTICATION_WINDOW_MS &&
    reauthenticatedAt.getTime() <= now.getTime()
  );
}

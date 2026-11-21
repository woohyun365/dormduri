import { MINUTE_MS } from '../../platform/time/clock.js';

/** OA-R5: five consecutive password or second-factor failures lock the account for 15 minutes. */
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_DURATION_MS = 15 * MINUTE_MS;

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

export function shouldLock(failedAttemptCount: number): boolean {
  return failedAttemptCount >= LOCKOUT_THRESHOLD;
}

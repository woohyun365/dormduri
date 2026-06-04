import { LOGIN_LOCKOUT_ATTEMPTS, LOGIN_LOCKOUT_TTL_SECONDS } from '../auth.constants.js';
import type { LoginResult } from '../auth.types.js';
import { authFailures } from '../auth-failures.js';

export function isLoginLockoutThresholdReached(failureCount: number) {
  return failureCount >= LOGIN_LOCKOUT_ATTEMPTS;
}

export function buildActiveLoginLockResult(remainingSeconds: number): LoginResult {
  return authFailures.loginLocked(remainingSeconds);
}

export function buildLoginFailureResult(failureCount: number): LoginResult {
  if (isLoginLockoutThresholdReached(failureCount)) {
    return authFailures.loginLocked(LOGIN_LOCKOUT_TTL_SECONDS);
  }

  return authFailures.invalidCredentials();
}

export function loginLockoutTtlSeconds() {
  return LOGIN_LOCKOUT_TTL_SECONDS;
}

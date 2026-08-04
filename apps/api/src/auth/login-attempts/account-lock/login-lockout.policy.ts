import { LOGIN_FAILURE_LIMIT, LOGIN_LOCKOUT_SECONDS } from '@repo/shared/auth/policy';
import type { LoginResponse } from '@repo/shared/auth/response';
import { authFailures } from '../../errors/auth-failures.js';

export function isLoginLockoutThresholdReached(failureCount: number) {
  return failureCount >= LOGIN_FAILURE_LIMIT;
}

export function buildActiveLoginLockResult(remainingSeconds: number): LoginResponse {
  return authFailures.loginLocked(remainingSeconds);
}

export function buildLoginFailureResult(failureCount: number): LoginResponse {
  if (isLoginLockoutThresholdReached(failureCount)) {
    return authFailures.loginLocked(LOGIN_LOCKOUT_SECONDS);
  }

  return authFailures.invalidCredentials();
}

export function loginLockoutTtlSeconds() {
  return LOGIN_LOCKOUT_SECONDS;
}

import type { LoginResult, SessionStatusResult, AuthSessionUserSummary } from './auth.types.js';

export function toLoginSuccessResult(
  accessToken: string,
  user: AuthSessionUserSummary,
): LoginResult {
  return {
    success: true,
    accessToken,
    user,
  };
}

export function toAuthenticatedSessionResult(user: AuthSessionUserSummary): SessionStatusResult {
  return {
    authenticated: true,
    user,
  };
}

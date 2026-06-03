import type { LoginResult, SessionStatusResult, AuthSessionUserSummary } from '../auth.types.js';

export function toLoginSuccessResult(
  accessToken: string,
  user: AuthSessionUserSummary,
  options: { renewalToken?: string; rememberMe?: boolean } = {},
): LoginResult {
  return {
    success: true,
    accessToken,
    ...(options.renewalToken ? { renewalToken: options.renewalToken } : {}),
    ...(typeof options.rememberMe === 'boolean' ? { rememberMe: options.rememberMe } : {}),
    user,
  };
}

export function toAuthenticatedSessionResult(user: AuthSessionUserSummary): SessionStatusResult {
  return {
    authenticated: true,
    user,
  };
}

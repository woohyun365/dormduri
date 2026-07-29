import type {
  LoginResult,
  SessionStatusResult,
  AuthSessionUserSummary,
} from '../domain/auth.types.js';

export function toLoginSuccessResult(
  accessToken: string,
  user: AuthSessionUserSummary,
  options: { renewalToken: string; rememberMe: boolean },
): LoginResult {
  return {
    success: true,
    accessToken,
    renewalToken: options.renewalToken,
    rememberMe: options.rememberMe,
    user,
  };
}

export function toAuthenticatedSessionResult(user: AuthSessionUserSummary): SessionStatusResult {
  return {
    authenticated: true,
    user,
  };
}

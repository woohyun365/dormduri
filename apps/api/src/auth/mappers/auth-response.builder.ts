import type { AuthenticatedSessionUser, LoginResponse } from '@repo/shared/auth/response';
import type { ApiSessionResponse } from '@repo/shared/auth/session';

export function toLoginSuccessResult(
  accessToken: string,
  user: AuthenticatedSessionUser,
  options: { renewalToken: string; rememberMe: boolean },
): LoginResponse {
  return {
    success: true,
    accessToken,
    renewalToken: options.renewalToken,
    rememberMe: options.rememberMe,
    user,
  };
}

export function toAuthenticatedSessionResult(user: AuthenticatedSessionUser): ApiSessionResponse {
  return {
    authenticated: true,
    user,
  };
}

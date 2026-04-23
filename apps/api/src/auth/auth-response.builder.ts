import type { LoginResult, SessionStatusResult, AuthProfileSnapshot } from './auth.types.js';
import { toUserProfileBridge } from './auth-user-view.js';

export function toLoginSuccessResult(
  accessToken: string,
  profile: AuthProfileSnapshot,
): LoginResult {
  return {
    success: true,
    accessToken,
    user: toUserProfileBridge(profile),
  };
}

export function toAuthenticatedSessionResult(profile: AuthProfileSnapshot): SessionStatusResult {
  return {
    authenticated: true,
    user: toUserProfileBridge(profile),
  };
}

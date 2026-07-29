import { normalizeWebRuntimeMode, type WebRuntimeMode } from './env';

export const AUTH_COOKIE_NAME = 'auth-token';
export const AUTH_RENEWAL_COOKIE_NAME = 'auth-renewal-token';
export const PRODUCTION_AUTH_COOKIE_NAME = '__Host-auth-token';
export const PRODUCTION_AUTH_RENEWAL_COOKIE_NAME = '__Host-auth-renewal-token';

export function resolveAuthCookieNames(
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(process.env.NODE_ENV),
) {
  if (runtimeMode === 'production') {
    return {
      access: PRODUCTION_AUTH_COOKIE_NAME,
      renewal: PRODUCTION_AUTH_RENEWAL_COOKIE_NAME,
    } as const;
  }

  return {
    access: AUTH_COOKIE_NAME,
    renewal: AUTH_RENEWAL_COOKIE_NAME,
  } as const;
}

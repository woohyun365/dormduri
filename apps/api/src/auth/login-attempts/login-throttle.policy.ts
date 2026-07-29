import type { AuthLoginThrottleScope } from './auth-login-metrics.service.js';

export const AUTH_LOGIN_BURST_THROTTLER = 'login-burst';
export const AUTH_LOGIN_SUSTAINED_THROTTLER = 'login-sustained';

export function resolveAuthLoginThrottleScope(
  throttlerName: string | undefined,
): AuthLoginThrottleScope | null {
  if (throttlerName === AUTH_LOGIN_BURST_THROTTLER) {
    return 'ip_burst';
  }
  if (throttlerName === AUTH_LOGIN_SUSTAINED_THROTTLER) {
    return 'ip_sustained';
  }
  return null;
}

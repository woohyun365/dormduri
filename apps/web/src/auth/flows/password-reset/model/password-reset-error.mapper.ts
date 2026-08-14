import { AUTH_RESET_RESTART_REQUIRED_CODE } from '@repo/shared/auth/response';

export function normalizeRetryAfterSeconds(seconds: number | undefined): number | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return Math.ceil(seconds);
}

export function isPasswordResetRestartRequired(code: string | undefined): boolean {
  return code === AUTH_RESET_RESTART_REQUIRED_CODE;
}

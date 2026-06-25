export const PASSWORD_RESET_RESTART_REQUIRED_CODE = 'AUTH_RESET_RESTART_REQUIRED';

export function normalizeRetryAfterSeconds(seconds: number | undefined): number | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return Math.ceil(seconds);
}

export function isPasswordResetRestartRequired(code: string | undefined): boolean {
  return code === PASSWORD_RESET_RESTART_REQUIRED_CODE;
}

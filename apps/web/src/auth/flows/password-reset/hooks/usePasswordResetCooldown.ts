import { useAuthCountdown } from '@/auth/hooks';
import { RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS } from '@repo/shared/auth/policy';

export function usePasswordResetCooldown(
  initialSeconds = RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
) {
  return useAuthCountdown(initialSeconds);
}

import { useAuthCountdown } from '@/auth/hooks';
import { RESET_PASSWORD_VERIFICATION_CODE_TTL } from '@/auth/model';

export function usePasswordResetCooldown(initialSeconds = RESET_PASSWORD_VERIFICATION_CODE_TTL) {
  return useAuthCountdown(initialSeconds);
}

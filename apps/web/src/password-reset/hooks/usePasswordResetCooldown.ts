import { useCountdown } from '@/hooks/useCountdown';
import { RESET_PASSWORD_VERIFICATION_CODE_TTL } from '@/constants/auth';

export function usePasswordResetCooldown(initialSeconds = RESET_PASSWORD_VERIFICATION_CODE_TTL) {
  return useCountdown(initialSeconds);
}

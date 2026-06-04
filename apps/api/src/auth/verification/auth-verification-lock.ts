import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';

export const VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE = 'verification_code_purpose';

export function getVerificationCodePurposeLockKey(
  emailNormalized: string,
  purpose: VerificationCodePurpose,
): string {
  return `${emailNormalized}:${purpose}`;
}

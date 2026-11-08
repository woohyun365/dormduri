import type { VerificationCodePurpose } from '@repo/database/enums';

export const VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE = 'verification_code_purpose';

export function getVerificationCodePurposeLockKey(
  subjectKey: string,
  purpose: VerificationCodePurpose,
): string {
  return `${subjectKey}:${purpose}`;
}

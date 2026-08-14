import {
  parseNewPasswordStructure,
  type PasswordStructureErrorCode,
} from '@repo/shared/auth/policy';

export type AuthPasswordPolicyRejectionReason =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'whitespace'
  | 'invalid_characters'
  | 'common'
  | 'contextual';

export type AuthPasswordStructureDecision =
  | { ok: true }
  | {
      ok: false;
      code: PasswordStructureErrorCode;
      message: string;
      reason: AuthPasswordPolicyRejectionReason;
    };

export function evaluateAuthPasswordStructure(
  password: string,
  email: string,
): AuthPasswordStructureDecision {
  const decision = parseNewPasswordStructure(password, email);
  if (decision.ok) {
    return decision;
  }

  return {
    ...decision,
    reason: toAuthPasswordPolicyRejectionReason(decision.code),
  };
}

function toAuthPasswordPolicyRejectionReason(
  code: PasswordStructureErrorCode,
): AuthPasswordPolicyRejectionReason {
  switch (code) {
    case 'REQUIRED':
      return 'required';
    case 'TOO_SHORT':
      return 'too_short';
    case 'TOO_LONG':
      return 'too_long';
    case 'WHITESPACE_NOT_ALLOWED':
      return 'whitespace';
    case 'INVALID_CHARACTERS':
      return 'invalid_characters';
    case 'MATCHES_EMAIL':
      return 'contextual';
    default:
      return assertNever(code);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled auth password structure code: ${String(value)}`);
}

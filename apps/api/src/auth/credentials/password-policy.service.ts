import { Injectable } from '@nestjs/common';
import { passwordMatchesEmailIdentity } from '@repo/shared/auth/policy';
import { hasBlockedPasswordRiskKey } from './password-policy/password-blocklist.lookup.js';

export const AUTH_PASSWORD_RISK_REJECTION_MESSAGE = '다른 비밀번호를 입력해 주세요.';

export interface AuthNewPasswordPolicyContext {
  email: string;
  nickname?: string | null;
}

export type AuthNewPasswordPolicyRejectionCode = 'COMMON_VALUE' | 'CONTEXTUAL_VALUE';

export type AuthNewPasswordPolicyDecision =
  | { ok: true }
  | {
      ok: false;
      code: AuthNewPasswordPolicyRejectionCode;
    };

function toPasswordRiskKey(value: string): string {
  return value.toLowerCase();
}

function contextualPasswordRiskKeys(context: AuthNewPasswordPolicyContext): Set<string> {
  const nicknameRiskKey = context.nickname ? toPasswordRiskKey(context.nickname) : '';

  return new Set([nicknameRiskKey].filter(Boolean));
}

@Injectable()
export class AuthPasswordPolicyService {
  evaluateNewPassword(
    password: string,
    context: AuthNewPasswordPolicyContext,
  ): AuthNewPasswordPolicyDecision {
    const riskKey = toPasswordRiskKey(password);
    if (hasBlockedPasswordRiskKey(riskKey)) {
      return { ok: false, code: 'COMMON_VALUE' };
    }
    if (
      passwordMatchesEmailIdentity(password, context.email) ||
      contextualPasswordRiskKeys(context).has(riskKey)
    ) {
      return { ok: false, code: 'CONTEXTUAL_VALUE' };
    }

    return { ok: true };
  }
}

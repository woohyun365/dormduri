import { Injectable } from '@nestjs/common';
import { hasBlockedPasswordRiskKey } from './password-blocklist.lookup.js';
import {
  evaluateAuthPasswordStructure,
  type AuthPasswordPolicyRejectionReason,
} from './auth-password-structure.policy.js';

export const AUTH_PASSWORD_RISK_REJECTION_MESSAGE = '다른 비밀번호를 입력해 주세요.';

export interface AuthNewPasswordPolicyContext {
  email: string;
  nickname?: string | null;
}

export type AuthNewPasswordPolicyRejectionCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'WHITESPACE_NOT_ALLOWED'
  | 'INVALID_CHARACTERS'
  | 'MATCHES_EMAIL'
  | 'COMMON_VALUE'
  | 'CONTEXTUAL_VALUE';

export type AuthNewPasswordPolicyDecision =
  | { ok: true }
  | {
      ok: false;
      code: AuthNewPasswordPolicyRejectionCode;
      message: string;
      reason: AuthPasswordPolicyRejectionReason;
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
    const structureDecision = evaluateAuthPasswordStructure(password, context.email);
    if (!structureDecision.ok) {
      return structureDecision;
    }

    const riskKey = toPasswordRiskKey(password);
    if (hasBlockedPasswordRiskKey(riskKey)) {
      return {
        ok: false,
        code: 'COMMON_VALUE',
        message: AUTH_PASSWORD_RISK_REJECTION_MESSAGE,
        reason: 'common',
      };
    }
    if (contextualPasswordRiskKeys(context).has(riskKey)) {
      return {
        ok: false,
        code: 'CONTEXTUAL_VALUE',
        message: AUTH_PASSWORD_RISK_REJECTION_MESSAGE,
        reason: 'contextual',
      };
    }

    return { ok: true };
  }
}

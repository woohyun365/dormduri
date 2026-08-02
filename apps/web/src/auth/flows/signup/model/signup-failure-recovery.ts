import type { SignupResponse } from '@repo/shared/auth/response';
import type { SignupFailure, SignupRecoveryField } from './signup-recovery.types';
import type { SignupStepId } from './signup-flow.types';
import { SIGNUP_FEEDBACK_COPY } from './signup-feedback.copy';

const RECOVERY_FIELDS = new Set<SignupRecoveryField>([
  'email',
  'nickname',
  'password',
  'campus',
  'gender',
  'collegeCode',
  'birthYear',
]);

function normalizeFieldErrors(
  fieldErrors: Record<string, string> | undefined,
): Partial<Record<SignupRecoveryField, string>> {
  if (!fieldErrors) return {};

  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [SignupRecoveryField, string] =>
      RECOVERY_FIELDS.has(entry[0] as SignupRecoveryField),
    ),
  );
}

function resolveValidationTarget(
  fieldErrors: Partial<Record<SignupRecoveryField, string>>,
): SignupStepId {
  if (fieldErrors.email) return 'EMAIL_VERIFICATION';
  if (fieldErrors.nickname || fieldErrors.password) return 'ACCOUNT_CREDENTIALS';
  return 'ACADEMIC_IDENTITY';
}

export function mapSignupFailure(
  result: Extract<SignupResponse, { success: false }>,
): SignupFailure {
  const message = result.error ?? SIGNUP_FEEDBACK_COPY.common.retry;

  switch (result.code) {
    case 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED':
      return {
        kind: 'verification_expired',
        code: result.code,
        message,
      };

    case 'AUTH_EMAIL_ALREADY_REGISTERED':
      return {
        kind: 'field_error',
        code: result.code,
        message,
        targetStepId: 'EMAIL_VERIFICATION',
        fieldErrors: {
          email: result.fieldErrors?.email ?? message,
        },
      };

    case 'AUTH_NICKNAME_ALREADY_TAKEN':
      return {
        kind: 'field_error',
        code: result.code,
        message,
        targetStepId: 'ACCOUNT_CREDENTIALS',
        fieldErrors: {
          nickname: result.fieldErrors?.nickname ?? message,
        },
      };

    case 'AUTH_SIGNUP_VALIDATION_FAILED': {
      const fieldErrors = normalizeFieldErrors(result.fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        return {
          kind: 'retryable',
          code: 'UNKNOWN',
          message,
        };
      }
      return {
        kind: 'field_error',
        code: result.code,
        message,
        targetStepId: resolveValidationTarget(fieldErrors),
        fieldErrors,
      };
    }

    default:
      return {
        kind: 'retryable',
        code: result.code ? 'UPSTREAM_UNAVAILABLE' : 'UNKNOWN',
        message,
      };
  }
}

export function createNetworkSignupFailure(): SignupFailure {
  return {
    kind: 'retryable',
    code: 'NETWORK_ERROR',
    message: SIGNUP_FEEDBACK_COPY.common.connectivity,
  };
}

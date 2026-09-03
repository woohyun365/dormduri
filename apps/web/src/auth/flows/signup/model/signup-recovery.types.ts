import type { SignupStepId } from './signup-flow.types';

export type SignupRecoveryField =
  'email' | 'nickname' | 'password' | 'campus' | 'gender' | 'collegeCode' | 'birthYear';

export type SignupFailure =
  | {
      readonly kind: 'retryable';
      readonly code: 'NETWORK_ERROR' | 'UPSTREAM_UNAVAILABLE' | 'UNKNOWN';
      readonly message: string;
    }
  | {
      readonly kind: 'verification_expired';
      readonly code: 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED';
      readonly message: string;
    }
  | {
      readonly kind: 'field_error';
      readonly code:
        | 'AUTH_EMAIL_ALREADY_REGISTERED'
        | 'AUTH_NICKNAME_ALREADY_TAKEN'
        | 'AUTH_PASSWORD_POLICY_VIOLATION'
        | 'AUTH_SIGNUP_VALIDATION_FAILED';
      readonly message: string;
      readonly targetStepId: SignupStepId;
      readonly fieldErrors: Partial<Record<SignupRecoveryField, string>>;
    };

export type PasswordResetStep = 'email' | 'verification' | 'verified' | 'newPassword' | 'complete';

export type PasswordResetFlowState =
  | {
      step: 'email';
      operation: 'idle' | 'submitting';
      email: string;
    }
  | {
      step: 'verification';
      operation: 'idle' | 'verifying' | 'resending';
      email: string;
      verificationCode: string;
      codeExpiresAt: number;
    }
  | {
      step: 'verified';
      operation: 'idle';
      email: string;
      grantExpiresAt: number;
    }
  | {
      step: 'newPassword';
      operation: 'idle' | 'submitting';
      email: string;
      newPassword: string;
      confirmPassword: string;
      grantExpiresAt: number;
    }
  | {
      step: 'complete';
      operation: 'idle';
    };

export type PasswordResetFlowAction =
  | { type: 'emailChanged'; email: string }
  | { type: 'sendCodeStarted' }
  | { type: 'sendCodeSucceeded'; email: string; codeExpiresAt: number }
  | { type: 'sendCodeFailed' }
  | { type: 'verificationCodeChanged'; verificationCode: string }
  | { type: 'verifyCodeStarted' }
  | { type: 'verifyCodeSucceeded'; grantExpiresAt: number }
  | { type: 'verifyCodeFailed' }
  | { type: 'continueAfterVerification' }
  | { type: 'newPasswordChanged'; newPassword: string }
  | { type: 'confirmPasswordChanged'; confirmPassword: string }
  | { type: 'resetPasswordStarted' }
  | { type: 'resetPasswordSucceeded' }
  | { type: 'resetPasswordFailed' }
  | { type: 'backToEmail' }
  | { type: 'restartEmailEntry' };

export type PasswordResetStatusVariant = 'info' | 'success' | 'warning' | 'error';

export interface PasswordResetStatus {
  variant: PasswordResetStatusVariant;
  title: string;
  message?: string;
  kind?: 'network' | 'attempts-exhausted';
  isRetryAfter?: boolean;
  countdownSeconds?: number;
}

export interface PasswordResetFieldErrors {
  code?: string;
  newPassword?: string;
}

export interface PasswordResetActionResult {
  success: boolean;
  error?: string;
  code?: string;
  fieldErrors?: PasswordResetFieldErrors;
  retryAfterSeconds?: number;
  restartRequired?: boolean;
}

export type PasswordResetStep = 'email' | 'verification' | 'newPassword' | 'complete';

export interface PasswordResetFlowState {
  step: PasswordResetStep;
  email: string;
  requestedEmail: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
  isSendingCode: boolean;
  isVerifyingCode: boolean;
  isResettingPassword: boolean;
}

export type PasswordResetFlowAction =
  | { type: 'emailChanged'; email: string }
  | { type: 'sendCodeStarted' }
  | { type: 'sendCodeSucceeded'; email: string }
  | { type: 'sendCodeFailed' }
  | { type: 'enterVerification' }
  | { type: 'verificationCodeChanged'; verificationCode: string }
  | { type: 'verifyCodeStarted' }
  | { type: 'verifyCodeSucceeded' }
  | { type: 'verifyCodeFailed' }
  | { type: 'newPasswordChanged'; newPassword: string }
  | { type: 'confirmPasswordChanged'; confirmPassword: string }
  | { type: 'resetPasswordStarted' }
  | { type: 'resetPasswordSucceeded' }
  | { type: 'resetPasswordFailed' }
  | { type: 'backToEmail' }
  | { type: 'backToVerification' }
  | { type: 'restartEmailEntry' };

export type PasswordResetStatusVariant = 'info' | 'success' | 'warning' | 'error';

export type PasswordResetStatusAction = 'restart';

export interface PasswordResetStatus {
  variant: PasswordResetStatusVariant;
  title: string;
  message: string;
  action?: PasswordResetStatusAction;
  isRetryAfter?: boolean;
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

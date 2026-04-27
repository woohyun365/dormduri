import type { AuthenticatedSessionUser } from './user-contract.js';
export type { SessionResponse } from './session-contract.js';

export interface GenericErrorResponse {
  success: boolean;
  error?: string;
  code?: string;
  userActionable?: boolean;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export interface LoginResponse extends GenericErrorResponse {
  accessToken?: string;
  user?: AuthenticatedSessionUser;
  locked?: boolean;
  remainingSeconds?: number;
}

export type VerifyCodeResponse = GenericErrorResponse;
export interface SignupResponse extends GenericErrorResponse {
  user?: AuthenticatedSessionUser;
}
export type ResetPasswordResponse = GenericErrorResponse;

export type SignupProfileValidationFieldErrors = Partial<
  Record<'email' | 'nickname' | 'password', string>
>;

export interface SignupProfileValidationResponse extends GenericErrorResponse {
  fieldErrors?: SignupProfileValidationFieldErrors;
}

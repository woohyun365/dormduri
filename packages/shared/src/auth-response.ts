import type { Campus } from './auth-contract.js';
import type { LifestyleData } from './lifestyle.js';

export interface AuthUserBridge {
  id: string;
  email: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
  lifestyle: LifestyleData;
  intro: string;
  dormitoryId: string | null;
}

export interface GenericErrorResponse {
  success: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export interface LoginResponse extends GenericErrorResponse {
  accessToken?: string;
  user?: AuthUserBridge;
  locked?: boolean;
  remainingSeconds?: number;
}

export interface VerifyCodeResponse extends GenericErrorResponse {}
export interface SignupResponse extends GenericErrorResponse {
  user?: AuthUserBridge;
}
export interface ResetPasswordResponse extends GenericErrorResponse {}

export interface SessionResponse {
  authenticated: boolean;
  user?: AuthUserBridge;
}

export interface SignupProfileValidationErrors {
  email?: string;
  nickname?: string;
  password?: string;
}

export interface SignupProfileValidationResponse extends GenericErrorResponse {
  errors?: SignupProfileValidationErrors;
}

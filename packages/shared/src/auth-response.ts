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
  code?: string;
  userActionable?: boolean;
  fieldErrors?: Record<string, string>;
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

export interface DevAuthUserSummary {
  id: string;
  email: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: Campus;
  dormitoryId: string | null;
  createdAt: string;
}

export interface DevAuthPresetUserSummary extends DevAuthUserSummary {
  presetKey: string;
  loginPassword: string;
}

export interface DevAuthPresetGroup {
  campus: Campus;
  label: string;
  users: DevAuthPresetUserSummary[];
}

export interface DevAuthUsersResponse extends GenericErrorResponse {
  presetGroups?: DevAuthPresetGroup[];
  users?: DevAuthUserSummary[];
}

export type SignupProfileValidationFieldErrors = Partial<
  Record<'email' | 'nickname' | 'password', string>
>;

export interface SignupProfileValidationResponse extends GenericErrorResponse {
  fieldErrors?: SignupProfileValidationFieldErrors;
}

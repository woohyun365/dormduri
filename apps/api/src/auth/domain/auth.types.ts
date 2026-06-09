import type { Campus, Gender } from '../../generated/prisma/enums.js';
import type { CollegeCode } from '@repo/shared/college-contract';
import type {
  ChangePasswordResponse,
  LoginResponse,
  RenewSessionResponse,
} from '@repo/shared/auth-response';
import type { SessionResponse } from '@repo/shared/session-contract';
import type { AuthenticatedSessionUser } from '@repo/shared/user';

export interface SignupInput {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  collegeCode: CollegeCode;
  birthYear: number;
}

export interface AuthSessionIssueResult {
  accessToken: string;
  sessionId: string;
  renewalToken?: string;
}

export type AuthSessionUserSummary = AuthenticatedSessionUser;

export type LoginResult = LoginResponse;
export type ChangePasswordResult = ChangePasswordResponse;
export type RenewSessionResult = RenewSessionResponse;

export interface GenericSuccessResult {
  success: boolean;
  error?: string;
  code?: string;
  userActionable?: boolean;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export type SessionStatusResult = SessionResponse;

import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { LoginResponse } from '@repo/shared/auth-response';
import type { SessionResponse } from '@repo/shared/session-contract';
import type { AuthenticatedSessionUser } from '@repo/shared/user-contract';

export interface SignupInput {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
}

export interface AuthSessionIssueResult {
  accessToken: string;
  sessionId: string;
}

export type AuthSessionUserSummary = AuthenticatedSessionUser;

export type LoginResult = LoginResponse;

export interface GenericSuccessResult {
  success: boolean;
  error?: string;
  code?: string;
  userActionable?: boolean;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export type SessionStatusResult = SessionResponse;

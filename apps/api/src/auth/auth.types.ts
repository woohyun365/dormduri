import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { LifestyleData } from './lifestyle.schema.js';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type { LoginResponse } from '@repo/shared/auth-response';
import type { SessionResponse } from '@repo/shared/session-contract';

export interface SignupInput {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Record<string, unknown>;
  intro: string;
}

export interface AuthProfileSnapshot {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: LifestyleData;
  intro: string;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

export interface AuthSessionIssueResult {
  accessToken: string;
  sessionId: string;
}

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

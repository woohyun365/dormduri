import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { LifestyleData } from './lifestyle.schema.js';

export interface AuthUserView {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: LifestyleData;
  intro: string;
  dormitoryId: string | null;
}

export interface LoginResult {
  success: boolean;
  accessToken?: string;
  user?: AuthUserView;
  error?: string;
  locked?: boolean;
  remainingSeconds?: number;
}

export interface GenericSuccessResult {
  success: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export interface SessionStatusResult {
  authenticated: boolean;
  user?: AuthUserView;
}

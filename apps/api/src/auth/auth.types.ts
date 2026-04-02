import type { Campus, Gender } from '../generated/prisma/enums.js';

export interface AuthUserView {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Record<string, unknown>;
  intro: string;
  dormitoryId: string | null;
  lastDrinkingChangeSeasonId: string | null;
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
}

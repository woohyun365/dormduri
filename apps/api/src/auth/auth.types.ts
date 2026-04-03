import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { LifestyleData } from './lifestyle.schema.js';

export interface SignupInput {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Record<string, unknown>;
  intro: string;
}

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

export interface AuthDevUserView {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  dormitoryId: string | null;
  createdAt: string;
}

export interface AuthDevPresetUserView extends AuthDevUserView {
  presetKey: string;
  loginPassword: string;
}

export interface AuthDevPresetGroupView {
  campus: Campus;
  label: string;
  users: AuthDevPresetUserView[];
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

export interface DevAuthUsersResult extends GenericSuccessResult {
  presetGroups?: AuthDevPresetGroupView[];
  users?: AuthDevUserView[];
}

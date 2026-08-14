import type { Campus, Gender } from '../../generated/prisma/enums.js';
import type { AuthenticatedSessionUser } from '@repo/shared/auth/response';

export interface AuthSessionUserRecord {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
}

export function toAuthenticatedSessionUser(user: AuthSessionUserRecord): AuthenticatedSessionUser {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
  };
}

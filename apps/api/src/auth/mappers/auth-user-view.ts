import type { Campus, Gender } from '../../generated/prisma/enums.js';
import type { AuthSessionUserSummary } from '../auth.types.js';

export interface AuthSessionUserRecord {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
}

export function toAuthSessionUserSummary(user: AuthSessionUserRecord): AuthSessionUserSummary {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
  };
}

import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthUserView } from './auth.types.js';
import type { LifestyleData } from './lifestyle.schema.js';

interface AuthUserRecord {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Prisma.JsonValue;
  intro: string;
  dormitoryId: string | null;
}

export function toAuthUserView(user: AuthUserRecord): AuthUserView {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
    lifestyle: user.lifestyle as LifestyleData,
    intro: user.intro,
    dormitoryId: user.dormitoryId,
  };
}

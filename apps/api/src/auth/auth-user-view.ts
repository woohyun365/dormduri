import type { Campus, DormitorySelectionState, Gender } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthUserView } from './auth.types.js';
import type { LifestyleData } from './lifestyle.schema.js';
import { UNASSIGNED_DORMITORY_ID } from '@repo/shared/dormitory-contract';

interface AuthUserRecord {
  id: string;
  email: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Prisma.JsonValue;
  intro: string;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

function toPublicDormitoryId(user: {
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}): string | null {
  if (user.dormitorySelectionState === 'UNASSIGNED') {
    return UNASSIGNED_DORMITORY_ID;
  }

  return user.dormitoryId;
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
    dormitoryId: toPublicDormitoryId(user),
  };
}

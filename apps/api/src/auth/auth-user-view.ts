import type { Campus, DormitorySelectionState, Gender } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthProfileSnapshot } from './auth.types.js';
import { UNASSIGNED_DORMITORY_ID } from '@repo/shared/dormitory-contract';
import type { UserProfileBridge } from '@repo/shared/profile-contract';
import { lifestyleSchema } from '@repo/shared/lifestyle';

export interface AuthUserRecord {
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

export function toAuthProfileSnapshot(user: AuthUserRecord): AuthProfileSnapshot {
  const parsedLifestyle = lifestyleSchema.safeParse(user.lifestyle);
  if (!parsedLifestyle.success) {
    throw new Error('[auth-user-view] invalid lifestyle payload from persistence layer');
  }

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    campus: user.campus,
    lifestyle: parsedLifestyle.data,
    intro: user.intro,
    dormitoryId: user.dormitoryId,
    dormitorySelectionState: user.dormitorySelectionState,
  };
}

export function toUserProfileBridge(profile: AuthProfileSnapshot): UserProfileBridge {
  return {
    id: profile.id,
    email: profile.email,
    nickname: profile.nickname,
    gender: profile.gender,
    campus: profile.campus,
    lifestyle: profile.lifestyle,
    intro: profile.intro,
    dormitoryId: toPublicDormitoryId(profile),
  };
}

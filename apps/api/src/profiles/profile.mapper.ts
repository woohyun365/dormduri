import type { Prisma } from '../generated/prisma/client.js';
import type { LifestyleData } from '../auth/lifestyle.schema.js';
import { lifestyleSchema } from '@repo/shared/lifestyle';
import {
  publicLifestyleSchema,
  type AdditionalProfile,
  type PublicLifestyle,
  type PublicProfile,
} from '@repo/shared/profile-contract';

export interface UserProfileRecord {
  userId: string;
  nickname: string;
  nicknameNormalized: string;
  nicknameChangedAt: Date | null;
  lifestyle: Prisma.JsonValue;
  intro: string;
  messageToRoommate: string | null;
  college: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithProfileRecord {
  id: string;
  email: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  dormitoryId: string | null;
  dormitorySelectionState: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
  profile: UserProfileRecord | null;
}

export function parseLifestyleOrThrow(lifestyle: Prisma.JsonValue): LifestyleData {
  const parsed = lifestyleSchema.safeParse(lifestyle);
  if (!parsed.success) {
    throw new Error('[profile.mapper] invalid lifestyle payload from persistence layer');
  }

  return parsed.data;
}

export function toAdditionalProfile(profile: UserProfileRecord): AdditionalProfile {
  return {
    college: profile.college,
    grade: profile.grade as AdditionalProfile['grade'],
    mbti: profile.mbti,
    birthYear: profile.birthYear,
  };
}

export function toPublicLifestyle(lifestyle: LifestyleData): PublicLifestyle {
  return publicLifestyleSchema.parse({
    bedtime: lifestyle.bedtime,
    wakeTime: lifestyle.wakeTime,
    sleepHabit: lifestyle.sleepHabit,
    sleepEnvironment: lifestyle.sleepEnvironment,
    screenUsage: lifestyle.screenUsage,
    noiseSensitivity: lifestyle.noiseSensitivity,
    smokingBehavior: lifestyle.smokingBehavior,
    indoorEating: lifestyle.indoorEating,
    phoneBehavior: lifestyle.phoneBehavior,
    earphoneUsage: lifestyle.earphoneUsage,
    cleanLevel: lifestyle.cleanLevel,
    relationshipStyle: lifestyle.relationshipStyle,
    temperatureSensitivity: lifestyle.temperatureSensitivity,
    smokingTolerance: lifestyle.smokingTolerance,
    phoneTolerance: lifestyle.phoneTolerance,
    earphoneExpectation: lifestyle.earphoneExpectation,
    sleepEnvPreference: lifestyle.sleepEnvPreference,
    screenTolerance: lifestyle.screenTolerance,
    indoorEatingTolerance: lifestyle.indoorEatingTolerance,
    cleanExpectation: lifestyle.cleanExpectation,
  });
}

export function toPublicProfile(user: UserWithProfileRecord): PublicProfile {
  if (!user.profile) {
    throw new Error('[profile.mapper] profile row is required');
  }

  const lifestyle = parseLifestyleOrThrow(user.profile.lifestyle);

  return {
    id: user.id,
    nickname: user.profile.nickname,
    gender: user.gender,
    campus: user.campus,
    lifestyle: toPublicLifestyle(lifestyle),
    intro: user.profile.intro,
    messageToRoommate: user.profile.messageToRoommate,
    additional: toAdditionalProfile(user.profile),
  };
}

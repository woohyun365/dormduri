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
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileViewRecord {
  nickname: string;
  nicknameNormalized: string;
  lifestyle: Prisma.JsonValue;
  intro: string;
  messageToRoommate: string | null;
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
}

export interface UserWithProfileRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
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

export function toAdditionalProfile(
  profile: Pick<ProfileViewRecord, 'collegeCode' | 'grade' | 'mbti' | 'birthYear'>,
): AdditionalProfile {
  return {
    college: profile.collegeCode as AdditionalProfile['college'],
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

export function toPublicProfile(
  user: Pick<UserWithProfileRecord, 'id' | 'gender' | 'campus'>,
  profile: ProfileViewRecord,
): PublicProfile {
  const lifestyle = parseLifestyleOrThrow(profile.lifestyle);

  return {
    id: user.id,
    nickname: profile.nickname,
    gender: user.gender,
    campus: user.campus,
    lifestyle: toPublicLifestyle(lifestyle),
    intro: profile.intro,
    messageToRoommate: profile.messageToRoommate,
    additional: toAdditionalProfile(profile),
  };
}

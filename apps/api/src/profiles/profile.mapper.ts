import type { LifestyleData } from '../auth/lifestyle.schema.js';
import { publicLifestyleSchema } from '@repo/shared/profile-contract';
import {
  type AdditionalProfile,
  type ProfileExposureLevel,
  type ProfileRelationToViewer,
  type ProfileSource,
  type PublicProfile,
  type PublicProfileActionCapabilities,
  type PublicLifestyle,
} from '@repo/shared/profile-contract';
import {
  type LifestyleColumns,
  toLifestyleFromColumns,
} from '../common/lifestyle/lifestyle.persistence.js';

export interface UserProfileRecord {
  userId: string;
  nickname: string;
  nicknameNormalized: string;
  nicknameChangedAt: Date | null;
  lifestyle: LifestyleData;
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
  lifestyle: LifestyleData;
  intro: string;
  messageToRoommate: string | null;
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
}

export type ProfileViewColumns = Omit<ProfileViewRecord, 'lifestyle'> & LifestyleColumns;
function parseEmbeddedLifestyle(input: unknown): LifestyleData | null {
  if (!input || typeof input !== 'object' || !('lifestyle' in input)) {
    return null;
  }

  return parseLifestyleOrNull((input as { lifestyle: unknown }).lifestyle);
}

export type UserProfileColumns = Omit<UserProfileRecord, 'lifestyle'> & LifestyleColumns;

export function mapProfileViewRecordFromColumns(
  profile: ProfileViewColumns | ProfileViewRecord,
): ProfileViewRecord {
  const embeddedLifestyle = parseEmbeddedLifestyle(profile);

  return {
    ...profile,
    lifestyle: embeddedLifestyle ?? parseLifestyleOrThrow(profile),
  };
}

export function mapUserProfileRecordFromColumns(
  profile: UserProfileColumns | UserProfileRecord,
): UserProfileRecord {
  const embeddedLifestyle = parseEmbeddedLifestyle(profile);

  return {
    ...profile,
    lifestyle: embeddedLifestyle ?? parseLifestyleOrThrow(profile),
  };
}

export interface UserWithProfileRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  profile: UserProfileRecord | null;
}

export function parseLifestyleOrThrow(lifestyle: unknown): LifestyleData {
  const parsed = parseLifestyleOrNull(lifestyle);
  if (!parsed) {
    throw new Error('[profile.mapper] invalid lifestyle payload from persistence layer');
  }

  return parsed;
}

export function parseLifestyleOrNull(lifestyle: unknown): LifestyleData | null {
  return toLifestyleFromColumns(lifestyle);
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
  options: {
    exposureLevel: ProfileExposureLevel;
    sourceProfile: ProfileSource;
    relationToViewer: ProfileRelationToViewer;
    actions: PublicProfileActionCapabilities;
    matchScore?: number;
  },
): PublicProfile {
  const base = {
    id: user.id,
    sourceProfile: options.sourceProfile,
    relationToViewer: options.relationToViewer,
    actions: options.actions,
    nickname: profile.nickname,
    intro: profile.intro,
    messageToRoommate: profile.messageToRoommate,
    additional: toAdditionalProfile(profile),
    ...(typeof options.matchScore === 'number'
      ? {
          matchScore: options.matchScore,
        }
      : {}),
  };

  if (options.exposureLevel === 'LIMITED') {
    return {
      ...base,
      exposureLevel: 'LIMITED',
    };
  }

  const lifestyle = parseLifestyleOrThrow(profile.lifestyle);

  return {
    ...base,
    exposureLevel: 'FULL',
    gender: user.gender,
    campus: user.campus,
    lifestyle: toPublicLifestyle(lifestyle),
  };
}

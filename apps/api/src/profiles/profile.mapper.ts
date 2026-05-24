import { publicLifestyleSchema } from '@repo/shared/profile-contract';
import type {
  AdditionalProfile,
  ProfileRelationToViewer,
  PublicProfile,
  PublicProfileActionCapabilities,
  PublicLifestyle,
} from '@repo/shared/profile-contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import {
  type LifestyleColumns,
  toLifestyleFromColumns,
} from '../common/lifestyle/lifestyle.persistence.js';

export interface ProfileViewRecord {
  nickname: string;
  nicknameNormalized: string;
  lifestyle: LifestyleData;
  intro: string;
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
}

export interface PublicProfileUserRecord {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
}

export type ProfileViewColumns = Omit<ProfileViewRecord, 'lifestyle'> & LifestyleColumns;
function parseEmbeddedLifestyle(input: unknown): LifestyleData | null {
  if (!input || typeof input !== 'object' || !('lifestyle' in input)) {
    return null;
  }

  return parseLifestyleOrNull((input as { lifestyle: unknown }).lifestyle);
}

export function mapProfileViewRecordFromColumns(
  profile: ProfileViewColumns | ProfileViewRecord,
): ProfileViewRecord {
  const embeddedLifestyle = parseEmbeddedLifestyle(profile);

  return {
    ...profile,
    lifestyle: embeddedLifestyle ?? parseLifestyleOrThrow(profile),
  };
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
  user: PublicProfileUserRecord,
  profile: ProfileViewRecord,
  options: {
    relationToViewer: ProfileRelationToViewer;
    actions: PublicProfileActionCapabilities;
    scoreVisible: boolean;
    matchScore?: number;
  },
): PublicProfile {
  return {
    id: user.id,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relationToViewer: options.relationToViewer,
    capabilities: {
      summaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: options.scoreVisible,
      actions: options.actions,
    },
    gender: user.gender,
    campus: user.campus,
    lifestyle: toPublicLifestyle(parseLifestyleOrThrow(profile.lifestyle)),
    nickname: profile.nickname,
    intro: profile.intro,
    additional: toAdditionalProfile(profile),
    ...(typeof options.matchScore === 'number'
      ? {
          matchScore: options.matchScore,
        }
      : {}),
  };
}

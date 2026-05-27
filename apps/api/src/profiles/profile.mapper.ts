import { publicLifestyleSchema } from '@repo/shared/profile-contract';
import type {
  AdditionalProfile,
  PublicProfile,
  PublicProfileActionCapabilities,
  PublicProfileTombstone,
  PublicProfileTombstoneReason,
  PublicTargetRelation,
  PublicTargetResultRead,
  PublicLifestyle,
} from '@repo/shared/profile-contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import {
  type LifestyleColumns,
  toLifestyleFromColumns,
} from '../common/lifestyle/lifestyle.persistence.js';
import { resolveProfileTombstoneDisplayName } from '../common/deidentification/deidentified-display.owner.js';

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
    relation: PublicTargetRelation;
    actions: PublicProfileActionCapabilities;
    resultRead: PublicTargetResultRead;
    scoreVisible: boolean;
    matchScore?: number;
  },
): PublicProfile {
  return {
    id: user.id,
    detailState: 'FULL',
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: options.relation,
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: options.scoreVisible,
    },
    actions: options.actions,
    resultRead: options.resultRead,
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

export function toTombstonePublicProfile(
  id: string,
  options: {
    reason: PublicProfileTombstoneReason;
    displayName?: string;
    message?: string;
    relation: PublicTargetRelation;
    actions: PublicProfileActionCapabilities;
    resultRead: PublicTargetResultRead;
    listSummaryVisible?: boolean;
  },
): PublicProfileTombstone {
  return {
    id,
    detailState: 'TOMBSTONE',
    relation: options.relation,
    exposure: {
      listSummaryVisible: options.listSummaryVisible ?? false,
      detailViewable: true,
      canViewFull: false,
      scoreVisible: false,
    },
    actions: {
      ...options.actions,
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      unavailableReasons: Array.from(
        new Set([
          ...options.actions.unavailableReasons,
          toTombstoneUnavailableReason(options.reason),
        ]),
      ),
    },
    resultRead: options.resultRead,
    tombstone: {
      reason: options.reason,
      displayName: resolveProfileTombstoneDisplayName({
        reason: options.reason,
        displayName: options.displayName,
      }),
      message: options.message ?? toTombstoneMessage(options.reason),
    },
  };
}

function toTombstoneUnavailableReason(
  reason: PublicProfileTombstoneReason,
): PublicProfileActionCapabilities['unavailableReasons'][number] {
  if (reason === 'TARGET_DELETED_OR_DEIDENTIFIED') {
    return 'TARGET_DELETED_OR_DEIDENTIFIED';
  }
  if (reason === 'SAFETY_OR_VISIBILITY_RESTRICTED') {
    return 'SAFETY_OR_VISIBILITY_RESTRICTED';
  }
  return 'TARGET_NOT_PUBLIC';
}

function toTombstoneMessage(reason: PublicProfileTombstoneReason) {
  switch (reason) {
    case 'TARGET_DELETED_OR_DEIDENTIFIED':
      return '탈퇴 또는 비식별화된 사용자라 상세 프로필을 볼 수 없습니다.';
    case 'SAFETY_OR_VISIBILITY_RESTRICTED':
      return '운영 정책에 따라 현재 상세 프로필을 표시할 수 없습니다.';
    case 'PROFILE_NO_LONGER_AVAILABLE':
      return '상대가 시즌 참여를 철회했거나 시즌 프로필이 더 이상 공개 가능한 상태가 아닙니다.';
    case 'DETAIL_ACCESS_REVOKED':
      return '현재 상태에서는 이 사용자의 상세 프로필을 볼 수 없습니다.';
  }
}

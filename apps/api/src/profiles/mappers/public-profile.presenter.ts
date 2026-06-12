import { publicLifestyleSchema } from '@repo/shared/profile/contract';
import type {
  PublicProfile,
  PublicProfileAdditional,
  PublicProfileActionCapabilities,
  PublicProfileTombstone,
  PublicProfileTombstoneReason,
  PublicTargetRelation,
  PublicTargetResultRead,
  PublicLifestyle,
} from '@repo/shared/profile/contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import {
  type LifestyleColumns,
  toLifestyleFromColumns,
} from '../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { resolveProfileTombstoneDisplayName } from '../../privacy/deidentification/deidentified-display.policy.js';

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

  return parseLifestyleOrNull(input.lifestyle);
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
    throw new Error('[public-profile.presenter] invalid lifestyle payload from persistence layer');
  }

  return parsed;
}

export function parseLifestyleOrNull(lifestyle: unknown): LifestyleData | null {
  return toLifestyleFromColumns(lifestyle);
}

export function toAdditionalProfile(
  profile: Pick<ProfileViewRecord, 'collegeCode' | 'grade' | 'mbti' | 'birthYear'>,
): PublicProfileAdditional {
  return {
    college: profile.collegeCode as PublicProfileAdditional['college'],
    grade: profile.grade as PublicProfileAdditional['grade'],
    mbti: profile.mbti as PublicProfileAdditional['mbti'],
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
        new Set([...options.actions.unavailableReasons, toTombstoneUnavailableReason()]),
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

function toTombstoneUnavailableReason(): PublicProfileActionCapabilities['unavailableReasons'][number] {
  return 'TARGET_NOT_PUBLIC';
}

function toTombstoneMessage(reason: PublicProfileTombstoneReason) {
  switch (reason) {
    case 'DETAIL_NOT_AVAILABLE_DIFFERENT_DORMITORY':
      return '본인 기숙사 외의 사용자의 상세 프로필은 열람할 수 없습니다.';
    case 'DETAIL_REQUIRES_REGISTRATION':
      return '시즌 등록을 완료한 뒤 상세 프로필을 볼 수 있습니다.';
    case 'DETAIL_REQUIRES_ASSIGNED_DORMITORY':
      return '기숙사 배정이 완료된 뒤 상세 프로필을 볼 수 있습니다.';
    case 'DETAIL_CONTEXT_NO_LONGER_VALID':
      return '이 상세 프로필 진입 경로가 더 이상 유효하지 않습니다.';
    case 'TARGET_NO_LONGER_DISCOVERABLE':
      return '상대가 시즌 참여를 철회했거나 더 이상 공개 가능한 상태가 아닙니다.';
  }
}

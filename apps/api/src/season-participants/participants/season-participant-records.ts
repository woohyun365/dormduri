import type { Prisma } from '../../generated/prisma/client.js';
import type {
  Campus,
  DormitorySelectionState,
  Gender,
  ParticipantHiddenReasonCode,
  ParticipantStatus,
  SeasonParticipationIntent,
} from '../../generated/prisma/enums.js';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { SeasonAdditionalProfileDraft } from '@repo/shared/profile/contract';
import type { ParticipantPolicyRecord } from '../policies/index.js';
import {
  lifestyleColumnSelect,
  toLifestyleFromColumns,
} from '../lifestyle/lifestyle-persistence.mapper.js';

export const currentSeasonParticipantProfileSelect = {
  participantId: true,
  nicknameSnapshot: true,
  nicknameNormalizedSnapshot: true,
  ...lifestyleColumnSelect,
  intro: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const currentSeasonParticipantSelect = {
  id: true,
  seasonId: true,
  userId: true,
  participationIntent: true,
  registeredAt: true,
  declinedAt: true,
  dormitoryId: true,
  dormitorySelectionState: true,
  participantStatus: true,
  campusCodeSnapshot: true,
  genderSnapshot: true,
  joinedAt: true,
  activatedAt: true,
  matchedAt: true,
  withdrawnAt: true,
  expiredAt: true,
  hiddenByAdminAt: true,
  hiddenReasonCode: true,
  hiddenReasonDetail: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: currentSeasonParticipantProfileSelect,
  },
} as const;

export interface SeasonParticipantEnsureInput {
  id: string;
  emailVerifiedAt: Date | null;
  gender: Gender;
  campus: Campus;
}

export interface CurrentSeasonParticipantProfileRecord {
  participantId: string;
  nicknameSnapshot: string;
  nicknameNormalizedSnapshot: string;
  lifestyle: LifestyleData;
  intro: string;
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrentSeasonParticipantRecord extends ParticipantPolicyRecord {
  id: string;
  seasonId: string;
  userId: string;
  participationIntent: SeasonParticipationIntent;
  registeredAt: Date | null;
  declinedAt: Date | null;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
  participantStatus: ParticipantStatus;
  campusCodeSnapshot: Campus;
  genderSnapshot: Gender;
  joinedAt: Date;
  activatedAt: Date | null;
  matchedAt: Date | null;
  withdrawnAt: Date | null;
  expiredAt: Date | null;
  hiddenByAdminAt: Date | null;
  hiddenReasonCode: ParticipantHiddenReasonCode | null;
  hiddenReasonDetail: string | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: CurrentSeasonParticipantProfileRecord | null;
}

export interface CanonicalSelectionState {
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
  source: 'SEASON_PARTICIPANT';
}

export interface SeasonParticipantBackfillResult {
  campus: Campus;
  seasonId: string;
  eligibleUserCount: number;
  createdCount: number;
  existingCount: number;
}

export type CurrentSeasonParticipantQueryRecord = Prisma.SeasonParticipantGetPayload<{
  select: typeof currentSeasonParticipantSelect;
}>;

export function toAdditionalProfileFromRecord(
  profile:
    | Pick<CurrentSeasonParticipantProfileRecord, 'collegeCode' | 'grade' | 'mbti' | 'birthYear'>
    | null
    | undefined,
): SeasonAdditionalProfileDraft {
  return {
    grade: (profile?.grade ?? null) as SeasonAdditionalProfileDraft['grade'],
    mbti: (profile?.mbti ?? null) as SeasonAdditionalProfileDraft['mbti'],
  };
}

export function mapCurrentSeasonParticipantProfileRecord(
  profile: CurrentSeasonParticipantQueryRecord['profile'],
): CurrentSeasonParticipantProfileRecord | null {
  if (!profile) {
    return null;
  }

  const lifestyle = toLifestyleFromColumns(profile);
  if (!lifestyle) {
    throw new Error('[season-participant-records] invalid season profile lifestyle columns');
  }

  return {
    participantId: profile.participantId,
    nicknameSnapshot: profile.nicknameSnapshot,
    nicknameNormalizedSnapshot: profile.nicknameNormalizedSnapshot,
    lifestyle,
    intro: profile.intro,
    collegeCode: profile.collegeCode,
    grade: profile.grade,
    mbti: profile.mbti,
    birthYear: profile.birthYear,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function mapCurrentSeasonParticipantRecord(
  participant: CurrentSeasonParticipantQueryRecord,
): CurrentSeasonParticipantRecord {
  return {
    ...participant,
    profile: mapCurrentSeasonParticipantProfileRecord(participant.profile),
  };
}

import type { Prisma } from '../generated/prisma/client.js';
import type {
  Campus,
  DormitorySelectionState,
  Gender,
  ParticipantHiddenReasonCode,
  ParticipantStatus,
  SeasonParticipationIntent,
} from '../generated/prisma/enums.js';
import type {
  ProfileViewRecord,
  UserProfileRecord,
  UserWithProfileRecord,
} from '../profiles/profile.mapper.js';
import type { ParticipantPolicyRecord } from './season-participant-policy.js';
import type { ProfileSource } from '@repo/shared/profile-contract';

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
    select: {
      participantId: true,
      nicknameSnapshot: true,
      nicknameNormalizedSnapshot: true,
      lifestyle: true,
      intro: true,
      messageToRoommate: true,
      collegeCode: true,
      grade: true,
      mbti: true,
      birthYear: true,
      templateSourceUserProfileUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export interface ParticipantBackfillSeed {
  id: string;
  emailVerifiedAt: Date | null;
  gender: Gender;
  campus: Campus;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

export interface CurrentSeasonParticipantProfileRecord {
  participantId: string;
  nicknameSnapshot: string;
  nicknameNormalizedSnapshot: string;
  lifestyle: Prisma.JsonValue;
  intro: string;
  messageToRoommate: string | null;
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
  templateSourceUserProfileUpdatedAt: Date | null;
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
  source: 'USER' | 'SEASON_PARTICIPANT';
}

export interface CanonicalProfileSource extends ProfileViewRecord {
  source: ProfileSource;
}

export interface ParticipantBackfillResult {
  campus: Campus;
  seasonId: string;
  eligibleUserCount: number;
  createdCount: number;
  existingCount: number;
}

export type VerifiedUserWithProfile = UserWithProfileRecord & {
  profile: NonNullable<UserWithProfileRecord['profile']>;
};

export type { UserProfileRecord, UserWithProfileRecord };

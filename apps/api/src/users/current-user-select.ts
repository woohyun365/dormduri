import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';
import { lifestyleColumnSelect } from '../profiles/profile-lifestyle.persistence.js';
import {
  mapUserProfileRecordFromColumns,
  type UserProfileColumns,
  type UserWithProfileRecord,
} from '../profiles/profile.mapper.js';
import {
  currentSeasonParticipantProfileSelect,
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
} from '../season-participants/season-participant-records.js';

const userProfileSelect = {
  userId: true,
  nickname: true,
  nicknameNormalized: true,
  nicknameChangedAt: true,
  ...lifestyleColumnSelect,
  intro: true,
  messageToRoommate: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function buildUserWithProfileSelect(seasonId: string | null) {
  return {
    id: true,
    email: true,
    emailVerifiedAt: true,
    gender: true,
    campus: true,
    seasonParticipants: seasonId
      ? {
          where: { seasonId },
          take: 1,
          select: currentSeasonParticipantSelect,
        }
      : undefined,
    profile: {
      select: userProfileSelect,
    },
  } as const;
}

const userDisplayIdentitySelect = {
  userId: true,
  nickname: true,
  nicknameNormalized: true,
  nicknameChangedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const userDismissedNoticeSelect = {
  noticeKey: true,
  dismissedAt: true,
} as const;

export function buildUserWithDisplayIdentitySelect() {
  return {
    id: true,
    email: true,
    emailVerifiedAt: true,
    deletedAt: true,
    gender: true,
    campus: true,
    displayIdentity: {
      select: userDisplayIdentitySelect,
    },
    dismissedNotices: {
      where: { noticeKey: SERVICE_INTRO_NOTICE_KEY },
      take: 1,
      select: userDismissedNoticeSelect,
    },
  } as const;
}

export interface UserWithProfileQueryRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  profile:
    | (UserProfileColumns & {
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        nickname: string;
        nicknameNormalized: string;
        nicknameChangedAt: Date | null;
        intro: string;
        messageToRoommate: string | null;
        collegeCode: string | null;
        grade: string | null;
        mbti: string | null;
        birthYear: number | null;
      })
    | null;
  seasonParticipants?: Array<Record<string, unknown>>;
}

export type UserWithParticipantProjectionRecord = UserWithProfileRecord & {
  seasonParticipants?: CurrentSeasonParticipantRecord[];
};

export interface UserDisplayIdentityRecord {
  userId: string;
  nickname: string;
  nicknameNormalized: string;
  nicknameChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDismissedNoticeRecord {
  noticeKey: string;
  dismissedAt: Date;
}

export interface UserWithDisplayIdentityQueryRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  displayIdentity: UserDisplayIdentityRecord | null;
  dismissedNotices: UserDismissedNoticeRecord[];
}

export interface UserWithDisplayIdentityRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  displayIdentity: UserDisplayIdentityRecord | null;
  dismissedNotices: UserDismissedNoticeRecord[];
}

export function mapUserWithDisplayIdentityProjection(
  user: UserWithDisplayIdentityQueryRecord,
): UserWithDisplayIdentityRecord {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    deletedAt: user.deletedAt,
    gender: user.gender,
    campus: user.campus,
    displayIdentity: user.displayIdentity,
    dismissedNotices: user.dismissedNotices,
  };
}

export function mapUserWithParticipantProjection(
  user: UserWithProfileQueryRecord,
): UserWithParticipantProjectionRecord {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    gender: user.gender,
    campus: user.campus,
    profile: user.profile ? mapUserProfileRecordFromColumns(user.profile) : null,
    seasonParticipants: user.seasonParticipants?.map((participant) =>
      mapCurrentSeasonParticipantRecord(
        participant as Parameters<typeof mapCurrentSeasonParticipantRecord>[0],
      ),
    ),
  };
}

export { currentSeasonParticipantProfileSelect };

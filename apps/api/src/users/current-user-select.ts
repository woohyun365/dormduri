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
    dormitoryId: true,
    dormitorySelectionState: true,
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

export interface UserWithProfileQueryRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  dormitoryId: string | null;
  dormitorySelectionState: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
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

export function mapUserWithParticipantProjection(
  user: UserWithProfileQueryRecord,
): UserWithParticipantProjectionRecord {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    gender: user.gender,
    campus: user.campus,
    dormitoryId: user.dormitoryId,
    dormitorySelectionState: user.dormitorySelectionState,
    profile: user.profile ? mapUserProfileRecordFromColumns(user.profile) : null,
    seasonParticipants: user.seasonParticipants?.map((participant) =>
      mapCurrentSeasonParticipantRecord(
        participant as Parameters<typeof mapCurrentSeasonParticipantRecord>[0],
      ),
    ),
  };
}

export { currentSeasonParticipantProfileSelect };

import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  Campus,
  DormitorySelectionState,
  Gender,
  ParticipantHiddenReasonCode,
  ParticipantStatus,
  SeasonParticipationIntent,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { ProfileViewRecord, UserProfileRecord } from '../profiles/profile.mapper.js';
import { SeasonsService } from '../seasons/seasons.service.js';

const currentSeasonParticipantSelect = {
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

export interface CurrentSeasonParticipantRecord {
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
  source: 'user' | 'season-participant';
}

export interface CanonicalProfileSource extends ProfileViewRecord {
  source: 'user-profile' | 'season-participant-profile';
}

export interface ParticipantBackfillResult {
  campus: Campus;
  seasonId: string;
  eligibleUserCount: number;
  createdCount: number;
  existingCount: number;
}

@Injectable()
export class SeasonParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
  ) {}

  async ensureCurrentSeasonParticipantForUser(
    user: ParticipantBackfillSeed,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    if (!user.emailVerifiedAt) {
      return null;
    }

    const seasonContext = await this.seasonsService.getCurrentSeasonContext(user.campus, now);
    if (!seasonContext) {
      return null;
    }

    const client = tx ?? this.prisma;
    return client.seasonParticipant.upsert({
      where: {
        seasonId_userId: {
          seasonId: seasonContext.season.id,
          userId: user.id,
        },
      },
      create: this.buildParticipantCreateData(user, seasonContext.season.id, now),
      update: {},
      select: currentSeasonParticipantSelect,
    });
  }

  async backfillCurrentSeasonParticipants(now: Date): Promise<ParticipantBackfillResult[]> {
    const operatedCampuses = await this.prisma.campusMaster.findMany({
      where: { isOperated: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const results: ParticipantBackfillResult[] = [];

    for (const campus of operatedCampuses) {
      const seasonContext = await this.seasonsService.getCurrentSeasonContext(campus.code, now);
      if (!seasonContext) {
        continue;
      }

      const eligibleUsers = await this.prisma.user.findMany({
        where: {
          campus: campus.code,
          emailVerifiedAt: { not: null },
        },
        select: {
          id: true,
          emailVerifiedAt: true,
          gender: true,
          campus: true,
          dormitoryId: true,
          dormitorySelectionState: true,
        },
        orderBy: { id: 'asc' },
      });

      const existingParticipants = await this.prisma.seasonParticipant.findMany({
        where: { seasonId: seasonContext.season.id },
        select: { userId: true },
      });
      const existingUserIds = new Set(
        existingParticipants.map((participant) => participant.userId),
      );

      const createData = eligibleUsers
        .filter((user) => !existingUserIds.has(user.id))
        .map((user) => this.buildParticipantCreateData(user, seasonContext.season.id, now));

      if (createData.length > 0) {
        await this.prisma.seasonParticipant.createMany({
          data: createData,
          skipDuplicates: true,
        });
      }

      results.push({
        campus: campus.code,
        seasonId: seasonContext.season.id,
        eligibleUserCount: eligibleUsers.length,
        createdCount: createData.length,
        existingCount: existingParticipants.length,
      });
    }

    return results;
  }

  selectCanonicalSelection(
    user: Pick<ParticipantBackfillSeed, 'dormitoryId' | 'dormitorySelectionState'>,
    participant: Pick<
      CurrentSeasonParticipantRecord,
      'dormitoryId' | 'dormitorySelectionState'
    > | null,
  ): CanonicalSelectionState {
    if (!participant) {
      return {
        dormitoryId: user.dormitoryId,
        dormitorySelectionState: user.dormitorySelectionState,
        source: 'user',
      };
    }

    return {
      dormitoryId: participant.dormitoryId,
      dormitorySelectionState: participant.dormitorySelectionState,
      source: 'season-participant',
    };
  }

  selectCanonicalProfile(
    baseProfile: UserProfileRecord,
    participantProfile: CurrentSeasonParticipantProfileRecord | null,
  ): CanonicalProfileSource {
    if (!participantProfile) {
      return {
        source: 'user-profile',
        nickname: baseProfile.nickname,
        nicknameNormalized: baseProfile.nicknameNormalized,
        lifestyle: baseProfile.lifestyle,
        intro: baseProfile.intro,
        messageToRoommate: baseProfile.messageToRoommate,
        collegeCode: baseProfile.collegeCode,
        grade: baseProfile.grade,
        mbti: baseProfile.mbti,
        birthYear: baseProfile.birthYear,
      };
    }

    return {
      source: 'season-participant-profile',
      nickname: participantProfile.nicknameSnapshot,
      nicknameNormalized: participantProfile.nicknameNormalizedSnapshot,
      lifestyle: participantProfile.lifestyle,
      intro: participantProfile.intro,
      messageToRoommate: participantProfile.messageToRoommate,
      collegeCode: participantProfile.collegeCode,
      grade: participantProfile.grade,
      mbti: participantProfile.mbti,
      birthYear: participantProfile.birthYear,
    };
  }

  pickCurrentSeasonParticipant(
    participants: CurrentSeasonParticipantRecord[] | null | undefined,
  ): CurrentSeasonParticipantRecord | null {
    return participants?.[0] ?? null;
  }

  private buildParticipantCreateData(
    user: ParticipantBackfillSeed,
    seasonId: string,
    now: Date,
  ): Prisma.SeasonParticipantCreateManyInput {
    return {
      seasonId,
      userId: user.id,
      dormitoryId: user.dormitoryId,
      dormitorySelectionState: user.dormitorySelectionState,
      participationIntent: 'UNDECIDED',
      participantStatus: 'NOT_STARTED',
      campusCodeSnapshot: user.campus,
      genderSnapshot: user.gender,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }
}

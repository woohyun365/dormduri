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
import type {
  ProfileViewRecord,
  UserProfileRecord,
  UserWithProfileRecord,
} from '../profiles/profile.mapper.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import {
  isParticipantRegistered,
  normalizeSelectionState,
  type ParticipantPolicyRecord,
} from './season-participant-policy.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
import type { ProfileSource } from '@repo/shared/profile-contract';

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

  async registerCurrentSeasonParticipation(
    userId: string,
    now?: Date,
  ): Promise<CurrentSeasonParticipantRecord> {
    const referenceNow = now ?? (await this.prisma.getDatabaseNow());
    const user = await this.getVerifiedUserWithProfile(userId);
    const seasonContext = await this.seasonsService.getCurrentSeasonContext(
      user.campus,
      referenceNow,
    );

    if (
      !seasonContext ||
      (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
    ) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    const participant = await this.ensureCurrentSeasonParticipantForUser(user, referenceNow);
    if (!participant) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    const normalizedSelection = normalizeSelectionState({
      registered: true,
      dormitorySelectionState: participant.dormitorySelectionState,
      dormitoryId: participant.dormitoryId,
    });
    const participantStatus =
      normalizedSelection.dormitorySelectionState === 'ASSIGNED' ? 'ACTIVE' : 'DRAFT';

    await this.prisma.$transaction(async (tx) => {
      await tx.seasonParticipant.update({
        where: { id: participant.id },
        data: {
          participationIntent: 'REGISTERED',
          registeredAt: participant.registeredAt ?? referenceNow,
          declinedAt: null,
          dormitorySelectionState: normalizedSelection.dormitorySelectionState,
          dormitoryId: normalizedSelection.dormitoryId,
          participantStatus,
          activatedAt:
            participantStatus === 'ACTIVE'
              ? (participant.activatedAt ?? referenceNow)
              : participant.activatedAt,
        },
      });

      await tx.seasonParticipantProfile.upsert({
        where: { participantId: participant.id },
        create: {
          participantId: participant.id,
          ...this.buildParticipantProfileSnapshotData(user.profile),
        } satisfies Prisma.SeasonParticipantProfileUncheckedCreateInput,
        update: this.buildParticipantProfileSnapshotData(
          user.profile,
        ) satisfies Prisma.SeasonParticipantProfileUncheckedUpdateInput,
      });

      if (
        user.dormitorySelectionState !== normalizedSelection.dormitorySelectionState ||
        user.dormitoryId !== normalizedSelection.dormitoryId
      ) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            dormitorySelectionState: normalizedSelection.dormitorySelectionState,
            dormitoryId: normalizedSelection.dormitoryId,
          },
        });
      }
    });

    const refreshed = await this.prisma.seasonParticipant.findUnique({
      where: { id: participant.id },
      select: currentSeasonParticipantSelect,
    });

    if (!refreshed) {
      throw new Error('[SeasonParticipantsService] registered participant not found after update');
    }

    return refreshed;
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
      | 'dormitoryId'
      | 'dormitorySelectionState'
      | 'participationIntent'
      | 'registeredAt'
      | 'declinedAt'
      | 'participantStatus'
    > | null,
  ): CanonicalSelectionState {
    if (!participant) {
      return {
        dormitoryId: user.dormitoryId,
        dormitorySelectionState: user.dormitorySelectionState,
        source: 'USER',
      };
    }

    const selection = normalizeSelectionState({
      registered: isParticipantRegistered(participant as ParticipantPolicyRecord),
      dormitorySelectionState: participant.dormitorySelectionState,
      dormitoryId: participant.dormitoryId,
    });

    return {
      dormitoryId: selection.dormitoryId,
      dormitorySelectionState: selection.dormitorySelectionState,
      source: 'SEASON_PARTICIPANT',
    };
  }

  selectCanonicalProfile(
    baseProfile: UserProfileRecord,
    participantProfile: CurrentSeasonParticipantProfileRecord | null,
  ): CanonicalProfileSource {
    return this.selectProfileBySource(
      baseProfile,
      participantProfile,
      participantProfile ? 'SEASON_PARTICIPANT_PROFILE' : 'USER_PROFILE',
    );
  }

  selectProfileBySource(
    baseProfile: UserProfileRecord,
    participantProfile: CurrentSeasonParticipantProfileRecord | null,
    source: ProfileSource,
  ): CanonicalProfileSource {
    if (source === 'SEASON_PARTICIPANT_PROFILE' && participantProfile) {
      return {
        source,
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

    return {
      source: 'USER_PROFILE',
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

  private buildParticipantProfileSnapshotData(
    baseProfile: NonNullable<UserWithProfileRecord['profile']>,
  ) {
    return {
      nicknameSnapshot: baseProfile.nickname,
      nicknameNormalizedSnapshot: baseProfile.nicknameNormalized,
      lifestyle: baseProfile.lifestyle as Prisma.InputJsonValue,
      intro: baseProfile.intro,
      messageToRoommate: baseProfile.messageToRoommate,
      collegeCode: baseProfile.collegeCode,
      grade: baseProfile.grade,
      mbti: baseProfile.mbti,
      birthYear: baseProfile.birthYear,
      templateSourceUserProfileUpdatedAt: baseProfile.updatedAt,
    };
  }

  private async getVerifiedUserWithProfile(
    userId: string,
  ): Promise<UserWithProfileRecord & { profile: NonNullable<UserWithProfileRecord['profile']> }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        gender: true,
        campus: true,
        dormitoryId: true,
        dormitorySelectionState: true,
        profile: {
          select: {
            userId: true,
            nickname: true,
            nicknameNormalized: true,
            nicknameChangedAt: true,
            lifestyle: true,
            intro: true,
            messageToRoommate: true,
            collegeCode: true,
            grade: true,
            mbti: true,
            birthYear: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user || !user.profile || !user.emailVerifiedAt) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    return user as UserWithProfileRecord & {
      profile: NonNullable<UserWithProfileRecord['profile']>;
    };
  }
}

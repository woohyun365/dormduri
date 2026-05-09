import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { normalizeSelectionState } from './season-participant-policy.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
import {
  currentSeasonParticipantSelect,
  type CurrentSeasonParticipantRecord,
  type ParticipantBackfillResult,
  type ParticipantBackfillSeed,
  type UserWithProfileRecord,
  type VerifiedUserWithProfile,
} from './season-participant-records.js';

interface SeasonParticipantWriteOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
}

export function createSeasonParticipantWriteOwner(deps: SeasonParticipantWriteOwnerDeps) {
  function buildParticipantCreateData(
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

  function buildParticipantProfileSnapshotData(
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

  async function getVerifiedUserWithProfile(userId: string): Promise<VerifiedUserWithProfile> {
    const user = await deps.prisma.user.findUnique({
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

    return user as VerifiedUserWithProfile;
  }

  async function ensureCurrentSeasonParticipantForUser(
    user: ParticipantBackfillSeed,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    if (!user.emailVerifiedAt) {
      return null;
    }

    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(user.campus, now);
    if (!seasonContext) {
      return null;
    }

    const client = tx ?? deps.prisma;
    return client.seasonParticipant.upsert({
      where: {
        seasonId_userId: {
          seasonId: seasonContext.season.id,
          userId: user.id,
        },
      },
      create: buildParticipantCreateData(user, seasonContext.season.id, now),
      update: {},
      select: currentSeasonParticipantSelect,
    });
  }

  async function registerCurrentSeasonParticipation(
    userId: string,
    now?: Date,
  ): Promise<CurrentSeasonParticipantRecord> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserWithProfile(userId);
    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(
      user.campus,
      referenceNow,
    );

    if (
      !seasonContext ||
      (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
    ) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    const participant = await ensureCurrentSeasonParticipantForUser(user, referenceNow);
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

    await deps.prisma.$transaction(async (tx) => {
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
          ...buildParticipantProfileSnapshotData(user.profile),
        } satisfies Prisma.SeasonParticipantProfileUncheckedCreateInput,
        update: buildParticipantProfileSnapshotData(
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

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: participant.id },
      select: currentSeasonParticipantSelect,
    });

    if (!refreshed) {
      throw new Error('[SeasonParticipantsService] registered participant not found after update');
    }

    return refreshed;
  }

  async function backfillCurrentSeasonParticipants(
    now: Date,
  ): Promise<ParticipantBackfillResult[]> {
    const operatedCampuses = await deps.prisma.campusMaster.findMany({
      where: { isOperated: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const results: ParticipantBackfillResult[] = [];

    for (const campus of operatedCampuses) {
      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus.code, now);
      if (!seasonContext) {
        continue;
      }

      const eligibleUsers = await deps.prisma.user.findMany({
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

      const existingParticipants = await deps.prisma.seasonParticipant.findMany({
        where: { seasonId: seasonContext.season.id },
        select: { userId: true },
      });
      const existingUserIds = new Set(
        existingParticipants.map((participant) => participant.userId),
      );

      const createData = eligibleUsers
        .filter((user) => !existingUserIds.has(user.id))
        .map((user) => buildParticipantCreateData(user, seasonContext.season.id, now));

      if (createData.length > 0) {
        await deps.prisma.seasonParticipant.createMany({
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

  return {
    ensureCurrentSeasonParticipantForUser,
    registerCurrentSeasonParticipation,
    backfillCurrentSeasonParticipants,
  };
}

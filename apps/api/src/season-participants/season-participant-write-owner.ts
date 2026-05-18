import type { Prisma } from '../generated/prisma/client.js';
import type { Campus } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import {
  appendSeasonParticipantProfileHistorySnapshot,
  appendUserProfileHistorySnapshot,
} from '../profiles/profile-history-owner.js';
import {
  lifestyleColumnSelect,
  toCompleteLifestyleColumnData,
} from '../profiles/profile-lifestyle.persistence.js';
import {
  mapUserProfileRecordFromColumns,
  parseLifestyleOrNull,
} from '../profiles/profile.mapper.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { normalizeSelectionState } from './season-participant-policy.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
  type SeasonParticipantBackfillResult,
  type SeasonParticipantEnsureInput,
  type UserWithProfileRecord,
  type VerifiedUserWithProfile,
} from './season-participant-records.js';

interface SeasonParticipantWriteOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
}

interface ProfileTemplateSyncFields {
  intro: string;
  messageToRoommate: string | null;
  collegeCode: string | null;
  grade: string | null;
  mbti: string | null;
  birthYear: number | null;
}

const seasonParticipantTemplateSyncFieldSelect = {
  intro: true,
  messageToRoommate: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
} as const;

export function createSeasonParticipantWriteOwner(deps: SeasonParticipantWriteOwnerDeps) {
  function buildParticipantCreateData(
    user: SeasonParticipantEnsureInput,
    seasonId: string,
    now: Date,
  ): Prisma.SeasonParticipantCreateManyInput {
    return {
      seasonId,
      userId: user.id,
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
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
  ): Omit<Prisma.SeasonParticipantProfileUncheckedCreateInput, 'participantId'> {
    return {
      nicknameSnapshot: baseProfile.nickname,
      nicknameNormalizedSnapshot: baseProfile.nicknameNormalized,
      ...toCompleteLifestyleColumnData(baseProfile.lifestyle),
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
        deletedAt: true,
        gender: true,
        campus: true,
        profile: {
          select: {
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
          },
        },
      },
    });

    if (!user || !user.profile || !user.emailVerifiedAt || user.deletedAt) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    const mappedUser = {
      ...user,
      profile: mapUserProfileRecordFromColumns(user.profile),
    } satisfies VerifiedUserWithProfile;

    const lifestyle = parseLifestyleOrNull(mappedUser.profile.lifestyle);
    if (!lifestyle || !isSeasonProfileComplete(lifestyle)) {
      throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
    }

    return mappedUser;
  }

  async function getVerifiedUserForSeasonAction(
    userId: string,
  ): Promise<{ id: string; campus: Campus }> {
    const user = await deps.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        campus: true,
        emailVerifiedAt: true,
        deletedAt: true,
      },
    });

    if (!user || !user.emailVerifiedAt || user.deletedAt) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    return { id: user.id, campus: user.campus };
  }

  async function ensureCurrentSeasonParticipantForUser(
    user: SeasonParticipantEnsureInput,
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
    const participant = await client.seasonParticipant.upsert({
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

    return mapCurrentSeasonParticipantRecord(participant);
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

    if (
      participant.participationIntent === 'DECLINED' ||
      participant.participantStatus === 'WITHDRAWN' ||
      participant.withdrawnAt
    ) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    const normalizedSelection = normalizeSelectionState({
      registered: true,
      dormitorySelectionState: participant.dormitorySelectionState,
      dormitoryId: participant.dormitoryId,
    });
    const participantStatus =
      normalizedSelection.dormitorySelectionState === 'ASSIGNED' ? 'ACTIVE' : 'DRAFT';

    const nextProfileSnapshot = buildParticipantProfileSnapshotData(user.profile);
    const shouldAppendSeasonProfileHistory =
      !participant.profile ||
      hasSeasonParticipantProfileSnapshotChanges(participant.profile, nextProfileSnapshot);

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
          ...nextProfileSnapshot,
        } satisfies Prisma.SeasonParticipantProfileUncheckedCreateInput,
        update: nextProfileSnapshot satisfies Prisma.SeasonParticipantProfileUncheckedUpdateInput,
      });

      if (shouldAppendSeasonProfileHistory) {
        await appendSeasonParticipantProfileHistorySnapshot(
          tx,
          participant.id,
          'SEASON_REGISTRATION',
        );
      }
    });

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: participant.id },
      select: currentSeasonParticipantSelect,
    });

    if (!refreshed) {
      throw new Error('[SeasonParticipantsService] registered participant not found after update');
    }

    return mapCurrentSeasonParticipantRecord(refreshed);
  }

  async function backfillCurrentSeasonParticipants(
    now: Date,
  ): Promise<SeasonParticipantBackfillResult[]> {
    const operatedCampuses = await deps.prisma.campusMaster.findMany({
      where: { isOperated: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const results: SeasonParticipantBackfillResult[] = [];

    for (const campus of operatedCampuses) {
      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus.code, now);
      if (!seasonContext) {
        continue;
      }

      const eligibleUsers = await deps.prisma.user.findMany({
        where: {
          campus: campus.code,
          emailVerifiedAt: { not: null },
          deletedAt: null,
        },
        select: {
          id: true,
          emailVerifiedAt: true,
          gender: true,
          campus: true,
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

  async function syncCurrentSeasonProfileTemplates(now: Date): Promise<number> {
    const operatedCampuses = await deps.prisma.campusMaster.findMany({
      where: { isOperated: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    let syncedCount = 0;

    for (const campus of operatedCampuses) {
      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus.code, now);
      if (!seasonContext) {
        continue;
      }

      const participants = await deps.prisma.seasonParticipant.findMany({
        where: {
          seasonId: seasonContext.season.id,
          participationIntent: 'REGISTERED',
          registeredAt: { not: null },
          profile: { isNot: null },
          user: {
            profile: { isNot: null },
          },
        },
        select: {
          id: true,
          userId: true,
          profile: {
            select: seasonParticipantTemplateSyncFieldSelect,
          },
          user: {
            select: {
              profile: {
                select: seasonParticipantTemplateSyncFieldSelect,
              },
            },
          },
        },
        orderBy: { id: 'asc' },
      });

      for (const participant of participants) {
        if (!participant.profile || !participant.user.profile) {
          continue;
        }

        const syncPatch = buildBaseProfileTemplateSyncPatch(
          participant.user.profile,
          participant.profile,
        );
        if (Object.keys(syncPatch).length === 0) {
          continue;
        }

        await deps.prisma.$transaction(async (tx) => {
          await tx.userProfile.update({
            where: { userId: participant.userId },
            data: syncPatch,
          });

          await appendUserProfileHistorySnapshot(tx, participant.userId, 'SYSTEM_BACKFILL');
        });

        syncedCount += 1;
      }
    }

    return syncedCount;
  }

  async function deregisterCurrentSeasonParticipation(
    userId: string,
    now?: Date,
  ): Promise<CurrentSeasonParticipantRecord> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(userId);
    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(
      user.campus,
      referenceNow,
    );

    if (
      !seasonContext ||
      (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
    ) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    const participant = await deps.prisma.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId: seasonContext.season.id,
          userId,
        },
      },
      select: currentSeasonParticipantSelect,
    });

    if (!participant) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    const mappedParticipant = mapCurrentSeasonParticipantRecord(participant);
    if (!mappedParticipant.registeredAt || mappedParticipant.participationIntent !== 'REGISTERED') {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    const liveActiveMatch = await deps.prisma.activeMatch.findFirst({
      where: {
        seasonId: mappedParticipant.seasonId,
        endedAt: null,
        OR: [{ participantAId: mappedParticipant.id }, { participantBId: mappedParticipant.id }],
      },
      select: { id: true },
    });

    if (liveActiveMatch) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    await deps.prisma.$transaction(async (tx) => {
      await tx.seasonParticipant.update({
        where: { id: mappedParticipant.id },
        data: {
          participationIntent: 'DECLINED',
          declinedAt: mappedParticipant.declinedAt ?? referenceNow,
          participantStatus: 'WITHDRAWN',
          withdrawnAt: mappedParticipant.withdrawnAt ?? referenceNow,
        },
      });

      await tx.matchRequest.updateMany({
        where: {
          seasonId: mappedParticipant.seasonId,
          status: 'PENDING',
          OR: [
            { requesterParticipantId: mappedParticipant.id },
            { receiverParticipantId: mappedParticipant.id },
          ],
        },
        data: {
          status: 'CANCELLED_BY_SYSTEM',
          terminalReason: 'WITHDRAWN_PARTICIPANT',
          terminalAt: referenceNow,
        },
      });

      await tx.conversationThread.updateMany({
        where: {
          seasonId: mappedParticipant.seasonId,
          activeMatchId: null,
          status: 'OPEN',
          OR: [{ participantAId: mappedParticipant.id }, { participantBId: mappedParticipant.id }],
        },
        data: {
          status: 'READ_ONLY',
          closedReason: 'PARTICIPANT_WITHDRAWN',
          closedAt: referenceNow,
        },
      });
    });

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: mappedParticipant.id },
      select: currentSeasonParticipantSelect,
    });

    if (!refreshed) {
      throw new Error(
        '[SeasonParticipantsService] deregistered participant not found after update',
      );
    }

    return mapCurrentSeasonParticipantRecord(refreshed);
  }

  return {
    ensureCurrentSeasonParticipantForUser,
    registerCurrentSeasonParticipation,
    backfillCurrentSeasonParticipants,
    deregisterCurrentSeasonParticipation,
    syncCurrentSeasonProfileTemplates,
  };
}

function hasSeasonParticipantProfileSnapshotChanges(
  currentProfile: NonNullable<CurrentSeasonParticipantRecord['profile']>,
  nextSnapshot: Omit<Prisma.SeasonParticipantProfileUncheckedCreateInput, 'participantId'>,
) {
  return (
    currentProfile.nicknameSnapshot !== nextSnapshot.nicknameSnapshot ||
    currentProfile.nicknameNormalizedSnapshot !== nextSnapshot.nicknameNormalizedSnapshot ||
    currentProfile.lifestyle.bedtime !== nextSnapshot.bedtime ||
    currentProfile.lifestyle.wakeTime !== nextSnapshot.wakeTime ||
    currentProfile.lifestyle.sleepHabit !== nextSnapshot.sleepHabit ||
    currentProfile.lifestyle.sleepEnvironment !== nextSnapshot.sleepEnvironment ||
    currentProfile.lifestyle.screenUsage !== nextSnapshot.screenUsage ||
    currentProfile.lifestyle.noiseSensitivity !== nextSnapshot.noiseSensitivity ||
    currentProfile.lifestyle.smokingBehavior !== nextSnapshot.smokingBehavior ||
    currentProfile.lifestyle.indoorEating !== nextSnapshot.indoorEating ||
    currentProfile.lifestyle.phoneBehavior !== nextSnapshot.phoneBehavior ||
    currentProfile.lifestyle.earphoneUsage !== nextSnapshot.earphoneUsage ||
    currentProfile.lifestyle.cleanLevel !== nextSnapshot.cleanLevel ||
    currentProfile.lifestyle.drinkingFrequency !== nextSnapshot.drinkingFrequency ||
    currentProfile.lifestyle.relationshipStyle !== nextSnapshot.relationshipStyle ||
    currentProfile.lifestyle.temperatureSensitivity !== nextSnapshot.temperatureSensitivity ||
    currentProfile.lifestyle.smokingTolerance !== nextSnapshot.smokingTolerance ||
    currentProfile.lifestyle.phoneTolerance !== nextSnapshot.phoneTolerance ||
    currentProfile.lifestyle.earphoneExpectation !== nextSnapshot.earphoneExpectation ||
    currentProfile.lifestyle.sleepEnvPreference !== nextSnapshot.sleepEnvPreference ||
    currentProfile.lifestyle.screenTolerance !== nextSnapshot.screenTolerance ||
    currentProfile.lifestyle.indoorEatingTolerance !== nextSnapshot.indoorEatingTolerance ||
    currentProfile.lifestyle.cleanExpectation !== nextSnapshot.cleanExpectation ||
    currentProfile.lifestyle.drinkingTolerance !== nextSnapshot.drinkingTolerance ||
    currentProfile.intro !== nextSnapshot.intro ||
    currentProfile.messageToRoommate !== nextSnapshot.messageToRoommate ||
    currentProfile.collegeCode !== nextSnapshot.collegeCode ||
    currentProfile.grade !== nextSnapshot.grade ||
    currentProfile.mbti !== nextSnapshot.mbti ||
    currentProfile.birthYear !== nextSnapshot.birthYear ||
    toComparableDateMillis(currentProfile.templateSourceUserProfileUpdatedAt) !==
      toComparableDateMillis(nextSnapshot.templateSourceUserProfileUpdatedAt)
  );
}

function buildBaseProfileTemplateSyncPatch(
  baseProfile: ProfileTemplateSyncFields,
  seasonProfile: ProfileTemplateSyncFields,
) {
  const patch: Partial<ProfileTemplateSyncFields> = {};

  if (baseProfile.messageToRoommate !== seasonProfile.messageToRoommate) {
    patch.messageToRoommate = seasonProfile.messageToRoommate;
  }
  if (baseProfile.collegeCode !== seasonProfile.collegeCode) {
    patch.collegeCode = seasonProfile.collegeCode;
  }
  if (baseProfile.grade !== seasonProfile.grade) {
    patch.grade = seasonProfile.grade;
  }
  if (baseProfile.mbti !== seasonProfile.mbti) {
    patch.mbti = seasonProfile.mbti;
  }
  if (baseProfile.birthYear !== seasonProfile.birthYear) {
    patch.birthYear = seasonProfile.birthYear;
  }

  return patch;
}

function toComparableDateMillis(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value).getTime();
}

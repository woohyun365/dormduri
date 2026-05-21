import type {
  SeasonProfileDraftRequest,
  SeasonProfileDraftResponse,
  SelectableDormitoriesResponse,
  SelectableDormitory,
  SelectedDormitorySubmitRequest,
  DormitorySelectionDraftResponse,
  SeasonParticipationCompletionState,
  SeasonProfileState,
  SeasonRegistrationBlockReason,
  SeasonRegistrationFinalizeResponse,
} from '@repo/shared/season-contract';
import { isSeasonProfileComplete, type LifestyleData } from '@repo/shared/lifestyle';
import { toDateOnlyString } from '@repo/shared/date-primitives';
import type { Prisma } from '../generated/prisma/client.js';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { formatKstDate } from '../seasons/season.utils.js';
import {
  lifestyleFieldNames,
  toCompleteLifestyleColumnData,
  toLifestyleColumnData,
} from '../profiles/profile-lifestyle.persistence.js';
import { isParticipantRegistered } from './season-participant-policy.js';
import { canCurrentDormitoryMatch } from './season-participant-selection.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  toAdditionalProfileFromRecord,
  type CurrentSeasonParticipantProfileRecord,
  type CurrentSeasonParticipantRecord,
  type SeasonParticipantBackfillResult,
  type SeasonParticipantEnsureInput,
} from './season-participant-records.js';

interface SeasonParticipantWriteOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
}

type DbClient = Prisma.TransactionClient | PrismaService;

type VerifiedSeasonActionUser = {
  id: string;
  campus: Campus;
  gender: Gender;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  displayIdentity: {
    userId: string;
    nickname: string;
    nicknameNormalized: string;
  } | null;
};

type SelectableDormitoryOperation = {
  seasonId: string;
  dormitoryId: string;
  isOperated: boolean;
  roomSelectionDate: Date;
  dormitory: {
    id: string;
    campusCode: Campus;
    nameKo: string;
    roomType: number;
    genderPolicy: 'M' | 'F' | 'BOTH';
  };
};

const userForSeasonActionSelect = {
  id: true,
  campus: true,
  gender: true,
  emailVerifiedAt: true,
  deletedAt: true,
  displayIdentity: {
    select: {
      userId: true,
      nickname: true,
      nicknameNormalized: true,
    },
  },
} as const;

const selectableDormitoryOperationSelect = {
  seasonId: true,
  dormitoryId: true,
  isOperated: true,
  roomSelectionDate: true,
  dormitory: {
    select: {
      id: true,
      campusCode: true,
      nameKo: true,
      roomType: true,
      genderPolicy: true,
    },
  },
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

  async function getVerifiedUserForSeasonAction(
    userId: string,
    client: DbClient = deps.prisma,
  ): Promise<VerifiedSeasonActionUser> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: userForSeasonActionSelect,
    });

    if (!user || !user.emailVerifiedAt || user.deletedAt || !user.displayIdentity) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    return user;
  }

  async function ensureCurrentSeasonParticipant(
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

  async function findCurrentSeasonParticipant(
    userId: string,
    seasonId: string,
    client: DbClient = deps.prisma,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    const participant = await client.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId,
          userId,
        },
      },
      select: currentSeasonParticipantSelect,
    });

    return participant ? mapCurrentSeasonParticipantRecord(participant) : null;
  }

  async function getCurrentSeasonProfile(
    userId: string,
    now?: Date,
  ): Promise<SeasonProfileDraftResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(userId);
    const seasonContext = await assertReadableSeasonContext(user.campus, referenceNow);
    const participant = await findCurrentSeasonParticipant(user.id, seasonContext.season.id);

    return participant
      ? buildSeasonProfileDraftResponse(participant, seasonContext, referenceNow)
      : buildEmptySeasonProfileDraftResponse(seasonContext);
  }

  async function createOrUpdateSeasonProfileDraft(
    userId: string,
    input: SeasonProfileDraftRequest,
    now?: Date,
  ): Promise<SeasonProfileDraftResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(userId);
    const seasonContext = await assertWritableSeasonContext(user.campus, referenceNow);

    const participantId = await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getVerifiedUserForSeasonAction(userId, tx);
      const participant = await ensureCurrentSeasonParticipant(txUser, referenceNow, tx);
      if (!participant) {
        throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
      }
      assertParticipantAllowsProfileDraftWrite(participant);

      const draftData = toSeasonProfileDraftColumnData(input, txUser.displayIdentity!);
      await tx.seasonParticipantProfile.upsert({
        where: { participantId: participant.id },
        create: {
          participantId: participant.id,
          ...draftData,
        },
        update: draftData,
      });

      return participant.id;
    });

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: participantId },
      select: currentSeasonParticipantSelect,
    });
    if (!refreshed) {
      throw new Error('[SeasonParticipantsService] season profile draft participant not found');
    }

    return buildSeasonProfileDraftResponse(
      mapCurrentSeasonParticipantRecord(refreshed),
      seasonContext,
      referenceNow,
    );
  }

  async function listSelectableDormitoriesForCurrentSeason(
    userId: string,
    now?: Date,
  ): Promise<SelectableDormitoriesResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(userId);
    const seasonContext = await assertWritableSeasonContext(user.campus, referenceNow);
    const participant = await findCurrentSeasonParticipant(user.id, seasonContext.season.id);
    const items = participant
      ? await listSelectableDormitoriesForParticipant(participant, seasonContext, referenceNow)
      : await listSelectableDormitoriesForSnapshot(
          user.campus,
          user.gender,
          seasonContext,
          referenceNow,
        );

    return {
      seasonId: seasonContext.season.id,
      seasonState: seasonContext.state,
      profileState: resolveSeasonProfileState(participant),
      completion: participant
        ? buildCompletionForParticipant(participant, seasonContext, referenceNow, items)
        : buildCompletionForSeasonActionSnapshot({
            seasonContext,
            profileComplete: false,
            dormitorySelectionReady: false,
            hasSelectableDormitories: items.length > 0,
          }),
      items,
    };
  }

  async function createOrUpdateDormitorySelection(
    userId: string,
    input: SelectedDormitorySubmitRequest,
    now?: Date,
  ): Promise<DormitorySelectionDraftResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(userId);
    const seasonContext = await assertWritableSeasonContext(user.campus, referenceNow);

    return deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getVerifiedUserForSeasonAction(userId, tx);
      const participant = await ensureCurrentSeasonParticipant(txUser, referenceNow, tx);
      if (!participant) {
        throw seasonParticipantsErrors.registrationNotAllowed();
      }
      assertParticipantAllowsDormitorySelection(participant);

      const operation = await validateDormitorySelection(
        tx,
        participant,
        seasonContext,
        input.dormitoryId,
        referenceNow,
      );

      const updated = await tx.seasonParticipant.update({
        where: { id: participant.id },
        data: {
          dormitorySelectionState: 'SELECTED',
          dormitoryId: operation.dormitoryId,
          participantStatus:
            participant.participantStatus === 'NOT_STARTED'
              ? 'DRAFT'
              : participant.participantStatus,
        },
        select: currentSeasonParticipantSelect,
      });
      const mapped = mapCurrentSeasonParticipantRecord(updated);

      return {
        seasonId: mapped.seasonId,
        participantId: mapped.id,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: operation.dormitoryId,
        profileState: resolveSeasonProfileState(mapped),
        completion: buildCompletionForParticipant(mapped, seasonContext, referenceNow, [
          mapSelectableDormitory(operation),
        ]),
      };
    });
  }

  async function finalizeSeasonRegistration(
    userId: string,
    now?: Date,
  ): Promise<SeasonRegistrationFinalizeResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(userId);
    const seasonContext = await assertRegistrationSeasonContext(user.campus, referenceNow);

    return deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getVerifiedUserForSeasonAction(userId, tx);
      let participant = await ensureCurrentSeasonParticipant(txUser, referenceNow, tx);
      if (!participant) {
        throw seasonParticipantsErrors.registrationNotAllowed();
      }
      assertParticipantAllowsRegistration(participant);
      assertSeasonProfileCompleteForRegistration(participant.profile);
      assertParticipantHasDormitorySelection(participant);

      const operation = await validateDormitorySelection(
        tx,
        participant,
        seasonContext,
        participant.dormitoryId!,
        referenceNow,
      );

      const registeredAt = referenceNow;
      await tx.seasonParticipant.update({
        where: { id: participant.id },
        data: {
          participationIntent: 'REGISTERED',
          registeredAt,
          declinedAt: null,
          dormitorySelectionState: 'ASSIGNED',
          dormitoryId: operation.dormitoryId,
          participantStatus: 'ACTIVE',
          activatedAt: participant.activatedAt ?? registeredAt,
        },
      });

      await tx.seasonParticipantProfile.update({
        where: { participantId: participant.id },
        data: {
          nicknameSnapshot: txUser.displayIdentity!.nickname,
          nicknameNormalizedSnapshot: txUser.displayIdentity!.nicknameNormalized,
        },
      });

      const refreshed = await tx.seasonParticipant.findUnique({
        where: { id: participant.id },
        select: currentSeasonParticipantSelect,
      });
      if (!refreshed) {
        throw new Error('[SeasonParticipantsService] finalized participant not found in tx');
      }
      participant = mapCurrentSeasonParticipantRecord(refreshed);
      assertSeasonProfileCompleteForRegistration(participant.profile);

      const history = await tx.seasonParticipantProfileHistory.create({
        data: toSeasonProfileHistoryCreateData(participant, registeredAt),
        select: {
          id: true,
          registeredAtSnapshot: true,
        },
      });

      return {
        seasonId: participant.seasonId,
        participantId: participant.id,
        participationIntent: 'REGISTERED',
        registeredAt: registeredAt.toISOString(),
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: operation.dormitoryId,
        profileState: 'REGISTRATION_FINALIZED',
        profileHistoryId: history.id,
        registeredAtSnapshot: (history.registeredAtSnapshot ?? registeredAt).toISOString(),
        completion: buildCompletion({
          hasCurrentSeason: true,
          campusOperated: true,
          activeSeasonPhase: true,
          profileComplete: true,
          dormitorySelectionReady: true,
          participantRegistrationLocked: false,
          accountOrParticipantInactive: false,
          hasSelectableDormitories: true,
          roomSelectionClosed: false,
        }),
      };
    });
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
        .filter((candidate) => !existingUserIds.has(candidate.id))
        .map((candidate) => buildParticipantCreateData(candidate, seasonContext.season.id, now));

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
    if (!isParticipantRegistered(mappedParticipant)) {
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

    await deps.prisma.runSerializableTransaction(async (tx) => {
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

  async function syncCurrentSeasonProfileTemplates(_now?: Date): Promise<number> {
    return 0;
  }

  async function hasSelectableDormitoriesForCurrentParticipant(
    participant: CurrentSeasonParticipantRecord | null,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    if (!participant || !seasonContext) {
      return false;
    }

    const items = await listSelectableDormitoriesForParticipant(participant, seasonContext, now);
    return items.length > 0;
  }

  async function hasSelectableDormitoriesForCurrentUser(
    user: SeasonParticipantEnsureInput,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    if (!user.emailVerifiedAt || !seasonContext) {
      return false;
    }

    const items = await listSelectableDormitoriesForSnapshot(
      user.campus,
      user.gender,
      seasonContext,
      now,
    );
    return items.length > 0;
  }

  async function hasValidDormitorySelectionForCurrentParticipant(
    participant: CurrentSeasonParticipantRecord | null,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    if (!participant || !seasonContext || !hasParticipantDormitorySelection(participant)) {
      return false;
    }

    const items = await listSelectableDormitoriesForParticipant(participant, seasonContext, now);
    return items.some((item) => item.id === participant.dormitoryId);
  }

  return {
    ensureCurrentSeasonParticipant,
    ensureCurrentSeasonParticipantForUser: ensureCurrentSeasonParticipant,
    findCurrentSeasonParticipant,
    getCurrentSeasonProfile,
    createOrUpdateSeasonProfileDraft,
    validateSeasonProfileCompleteness,
    assertSeasonProfileCompleteForRegistration,
    listSelectableDormitoriesForCurrentSeason,
    listSelectableDormitoriesForParticipant,
    hasSelectableDormitoriesForCurrentParticipant,
    hasSelectableDormitoriesForCurrentUser,
    hasValidDormitorySelectionForCurrentParticipant,
    validateDormitorySelection,
    createOrUpdateDormitorySelection,
    finalizeSeasonRegistration,
    backfillCurrentSeasonParticipants,
    deregisterCurrentSeasonParticipation,
    syncCurrentSeasonProfileTemplates,
  };

  async function assertReadableSeasonContext(campus: Campus, now: Date) {
    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus, now);
    if (!seasonContext) {
      throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
    }

    return seasonContext;
  }

  async function assertWritableSeasonContext(campus: Campus, now: Date) {
    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus, now);
    if (
      !seasonContext ||
      (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
    ) {
      throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
    }

    return seasonContext;
  }

  async function assertRegistrationSeasonContext(campus: Campus, now: Date) {
    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus, now);
    if (
      !seasonContext ||
      (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
    ) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    return seasonContext;
  }

  async function listSelectableDormitoriesForParticipant(
    participant: CurrentSeasonParticipantRecord,
    seasonContext: CurrentSeasonContext,
    now: Date,
    client: DbClient = deps.prisma,
  ): Promise<SelectableDormitory[]> {
    return listSelectableDormitoriesForSnapshot(
      participant.campusCodeSnapshot,
      participant.genderSnapshot,
      seasonContext,
      now,
      client,
    );
  }

  async function listSelectableDormitoriesForSnapshot(
    campusCode: Campus,
    gender: Gender,
    seasonContext: CurrentSeasonContext,
    now: Date,
    client: DbClient = deps.prisma,
  ): Promise<SelectableDormitory[]> {
    const where: Prisma.SeasonDormitoryOperationWhereInput = {
      seasonId: seasonContext.season.id,
      isOperated: true,
      dormitory: {
        campusCode,
        genderPolicy: { in: [gender, 'BOTH'] },
      },
    };

    if (seasonContext.state === 'SEASON_MATCHING') {
      where.roomSelectionDate = { gte: new Date(`${formatKstDate(now)}T00:00:00.000Z`) };
    }

    const operations = await client.seasonDormitoryOperation.findMany({
      where,
      select: selectableDormitoryOperationSelect,
      orderBy: [
        { roomSelectionDate: 'asc' },
        { dormitory: { sortOrder: 'asc' } },
        { dormitoryId: 'asc' },
      ],
    });

    return operations.map(mapSelectableDormitory);
  }

  async function validateDormitorySelection(
    client: DbClient,
    participant: CurrentSeasonParticipantRecord,
    seasonContext: CurrentSeasonContext,
    dormitoryId: string,
    now: Date,
  ): Promise<SelectableDormitoryOperation> {
    const operation = await client.seasonDormitoryOperation.findUnique({
      where: {
        seasonId_dormitoryId: {
          seasonId: seasonContext.season.id,
          dormitoryId,
        },
      },
      select: selectableDormitoryOperationSelect,
    });

    if (!operation?.isOperated) {
      throw seasonParticipantsErrors.dormitorySelectionInvalid();
    }

    const typedOperation = operation as SelectableDormitoryOperation;
    if (typedOperation.dormitory.campusCode !== participant.campusCodeSnapshot) {
      throw seasonParticipantsErrors.dormitorySelectionInvalid();
    }
    if (!isGenderCompatible(participant.genderSnapshot, typedOperation.dormitory.genderPolicy)) {
      throw seasonParticipantsErrors.dormitorySelectionInvalid();
    }
    if (
      seasonContext.state === 'SEASON_MATCHING' &&
      !canCurrentDormitoryMatch(seasonContext, typedOperation.dormitoryId, now)
    ) {
      throw seasonParticipantsErrors.dormitorySelectionInvalid();
    }

    return typedOperation;
  }
}

export function validateSeasonProfileCompleteness(
  profile: CurrentSeasonParticipantProfileRecord | null | undefined,
): { complete: boolean } {
  if (!profile) {
    return { complete: false };
  }

  return {
    complete: isSeasonProfileComplete(profile.lifestyle) && profile.intro.trim().length > 0,
  };
}

export function assertSeasonProfileCompleteForRegistration(
  profile: CurrentSeasonParticipantProfileRecord | null | undefined,
) {
  if (!validateSeasonProfileCompleteness(profile).complete) {
    throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
  }
}

export function resolveSeasonProfileState(
  participant: CurrentSeasonParticipantRecord | null | undefined,
): SeasonProfileState {
  if (!participant?.profile) {
    return 'NONE';
  }
  if (isParticipantRegistered(participant)) {
    return 'REGISTRATION_FINALIZED';
  }
  return validateSeasonProfileCompleteness(participant.profile).complete ? 'COMPLETE' : 'DRAFT';
}

export function buildCompletion(input: {
  hasCurrentSeason: boolean;
  campusOperated: boolean;
  activeSeasonPhase: boolean;
  profileComplete: boolean;
  dormitorySelectionReady: boolean;
  participantRegistrationLocked: boolean;
  accountOrParticipantInactive: boolean;
  hasSelectableDormitories?: boolean;
  roomSelectionClosed?: boolean;
}): SeasonParticipationCompletionState {
  const registrationUnavailableReasons: SeasonRegistrationBlockReason[] = [];

  if (!input.hasCurrentSeason) {
    registrationUnavailableReasons.push('NO_CURRENT_SEASON');
  }
  if (!input.campusOperated) {
    registrationUnavailableReasons.push('UNSUPPORTED_CAMPUS');
  }
  if (input.hasCurrentSeason && !input.activeSeasonPhase) {
    registrationUnavailableReasons.push('SEASON_NOT_OPEN');
  }
  if (!input.profileComplete) {
    registrationUnavailableReasons.push('PROFILE_INCOMPLETE');
  }
  if (input.activeSeasonPhase && !input.dormitorySelectionReady) {
    registrationUnavailableReasons.push('DORMITORY_SELECTION_REQUIRED');
  }
  if (input.activeSeasonPhase && input.hasSelectableDormitories === false) {
    registrationUnavailableReasons.push('NO_SELECTABLE_DORMITORY');
  }
  if (input.activeSeasonPhase && input.roomSelectionClosed) {
    registrationUnavailableReasons.push('DORMITORY_SELECTION_CLOSED');
  }
  if (input.participantRegistrationLocked) {
    registrationUnavailableReasons.push('WITHDRAWN_OR_DECLINED_LOCK');
  }
  if (input.accountOrParticipantInactive) {
    registrationUnavailableReasons.push('ACCOUNT_OR_PARTICIPANT_INACTIVE');
  }

  return {
    profileCompletionRequired: input.activeSeasonPhase && !input.profileComplete,
    dormitorySelectionRequired: input.activeSeasonPhase && !input.dormitorySelectionReady,
    registrationUnavailable: registrationUnavailableReasons.length > 0,
    registrationUnavailableReasons,
  };
}

function buildEmptySeasonProfileDraftResponse(
  seasonContext: CurrentSeasonContext,
): SeasonProfileDraftResponse {
  const activeSeasonPhase =
    seasonContext.state === 'SEASON_OPEN' || seasonContext.state === 'SEASON_MATCHING';

  return {
    participantId: null,
    seasonId: seasonContext.season.id,
    state: 'NONE',
    lifestyle: emptyLifestyle(),
    intro: '',
    additional: toAdditionalProfileFromRecord(null),
    completion: buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase,
      profileComplete: false,
      dormitorySelectionReady: false,
      participantRegistrationLocked: false,
      accountOrParticipantInactive: false,
    }),
    draftWritable: activeSeasonPhase,
  };
}

function buildCompletionForSeasonActionSnapshot(input: {
  seasonContext: CurrentSeasonContext;
  profileComplete: boolean;
  dormitorySelectionReady: boolean;
  hasSelectableDormitories: boolean;
}): SeasonParticipationCompletionState {
  const activeSeasonPhase =
    input.seasonContext.state === 'SEASON_OPEN' || input.seasonContext.state === 'SEASON_MATCHING';

  return buildCompletion({
    hasCurrentSeason: true,
    campusOperated: true,
    activeSeasonPhase,
    profileComplete: input.profileComplete,
    dormitorySelectionReady: input.dormitorySelectionReady,
    participantRegistrationLocked: false,
    accountOrParticipantInactive: false,
    hasSelectableDormitories: input.hasSelectableDormitories,
    roomSelectionClosed:
      input.seasonContext.state === 'SEASON_MATCHING' && !input.hasSelectableDormitories,
  });
}

function buildSeasonProfileDraftResponse(
  participant: CurrentSeasonParticipantRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
): SeasonProfileDraftResponse {
  const profileState = resolveSeasonProfileState(participant);
  const profileComplete = validateSeasonProfileCompleteness(participant.profile).complete;
  const activeSeasonPhase =
    seasonContext.state === 'SEASON_OPEN' || seasonContext.state === 'SEASON_MATCHING';

  return {
    participantId: participant.id,
    seasonId: participant.seasonId,
    state: profileState,
    lifestyle: participant.profile?.lifestyle ?? emptyLifestyle(),
    intro: participant.profile?.intro ?? '',
    additional: toAdditionalProfileFromRecord(participant.profile),
    completion: buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase,
      profileComplete,
      dormitorySelectionReady: hasParticipantDormitorySelection(participant),
      participantRegistrationLocked: isParticipantRegistrationLocked(participant),
      accountOrParticipantInactive: isParticipantInactive(participant),
      roomSelectionClosed:
        participant.dormitoryId !== null &&
        seasonContext.state === 'SEASON_MATCHING' &&
        !canCurrentDormitoryMatch(seasonContext, participant.dormitoryId, now),
    }),
    draftWritable:
      activeSeasonPhase &&
      !isParticipantRegistered(participant) &&
      !isParticipantLockedOrInactive(participant),
  };
}

function buildCompletionForParticipant(
  participant: CurrentSeasonParticipantRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
  selectableDormitories?: SelectableDormitory[],
): SeasonParticipationCompletionState {
  const profileComplete = validateSeasonProfileCompleteness(participant.profile).complete;
  const activeSeasonPhase =
    seasonContext.state === 'SEASON_OPEN' || seasonContext.state === 'SEASON_MATCHING';
  const dormitorySelectionReady =
    hasParticipantDormitorySelection(participant) &&
    (selectableDormitories === undefined ||
      selectableDormitories.some((item) => item.id === participant.dormitoryId));

  return buildCompletion({
    hasCurrentSeason: true,
    campusOperated: true,
    activeSeasonPhase,
    profileComplete,
    dormitorySelectionReady,
    participantRegistrationLocked: isParticipantRegistrationLocked(participant),
    accountOrParticipantInactive: isParticipantInactive(participant),
    hasSelectableDormitories: (selectableDormitories?.length ?? 1) > 0,
    roomSelectionClosed:
      seasonContext.state === 'SEASON_MATCHING' &&
      selectableDormitories !== undefined &&
      selectableDormitories.length === 0,
  });
}

function toSeasonProfileDraftColumnData(
  input: SeasonProfileDraftRequest,
  displayIdentity: NonNullable<VerifiedSeasonActionUser['displayIdentity']>,
): Omit<Prisma.SeasonParticipantProfileUncheckedCreateInput, 'participantId'> {
  const additional = input.additional;
  return {
    nicknameSnapshot: displayIdentity.nickname,
    nicknameNormalizedSnapshot: displayIdentity.nicknameNormalized,
    ...toLifestyleColumnData(input.lifestyle),
    intro: input.intro.trim(),
    ...(additional
      ? {
          collegeCode: additional.college,
          grade: additional.grade,
          mbti: additional.mbti,
          birthYear: additional.birthYear,
        }
      : {}),
  };
}

function toSeasonProfileHistoryCreateData(
  participant: CurrentSeasonParticipantRecord,
  registeredAt: Date,
): Prisma.SeasonParticipantProfileHistoryUncheckedCreateInput {
  if (!participant.profile) {
    throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
  }

  return {
    participantId: participant.id,
    seasonId: participant.seasonId,
    nicknameSnapshot: participant.profile.nicknameSnapshot,
    nicknameNormalizedSnapshot: participant.profile.nicknameNormalizedSnapshot,
    ...toCompleteLifestyleColumnData(participant.profile.lifestyle),
    intro: participant.profile.intro,
    collegeCode: participant.profile.collegeCode,
    grade: participant.profile.grade,
    mbti: participant.profile.mbti,
    birthYear: participant.profile.birthYear,
    registeredAtSnapshot: registeredAt,
    source: 'SEASON_REGISTRATION',
  };
}

function mapSelectableDormitory(operation: SelectableDormitoryOperation): SelectableDormitory {
  return {
    id: operation.dormitory.id,
    name: operation.dormitory.nameKo,
    campusCode: operation.dormitory.campusCode,
    roomType: operation.dormitory.roomType as 2 | 3,
    genderPolicy: operation.dormitory.genderPolicy,
    roomSelectionDate: toDateOnlyString(operation.roomSelectionDate),
  };
}

function assertParticipantAllowsProfileDraftWrite(participant: CurrentSeasonParticipantRecord) {
  if (isParticipantRegistered(participant) || isParticipantLockedOrInactive(participant)) {
    throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
  }
}

function assertParticipantAllowsDormitorySelection(participant: CurrentSeasonParticipantRecord) {
  if (isParticipantRegistered(participant) || isParticipantLockedOrInactive(participant)) {
    throw seasonParticipantsErrors.dormitorySelectionInvalid();
  }
}

function assertParticipantAllowsRegistration(participant: CurrentSeasonParticipantRecord) {
  if (
    isParticipantRegistered(participant) ||
    isParticipantLockedOrInactive(participant) ||
    isParticipantRegistrationLocked(participant)
  ) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }
}

function assertParticipantHasDormitorySelection(participant: CurrentSeasonParticipantRecord) {
  if (!hasParticipantDormitorySelection(participant)) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }
}

function hasParticipantDormitorySelection(participant: CurrentSeasonParticipantRecord) {
  return Boolean(
    participant.dormitoryId !== null &&
    (participant.dormitorySelectionState === 'SELECTED' ||
      participant.dormitorySelectionState === 'ASSIGNED'),
  );
}

function isParticipantRegistrationLocked(participant: CurrentSeasonParticipantRecord) {
  return Boolean(
    participant.participationIntent === 'DECLINED' ||
    participant.participantStatus === 'WITHDRAWN' ||
    participant.withdrawnAt ||
    participant.declinedAt,
  );
}

function isParticipantInactive(participant: CurrentSeasonParticipantRecord) {
  return Boolean(participant.hiddenByAdminAt || participant.deactivatedAt);
}

function isParticipantLockedOrInactive(participant: CurrentSeasonParticipantRecord) {
  return isParticipantRegistrationLocked(participant) || isParticipantInactive(participant);
}

function isGenderCompatible(gender: Gender, genderPolicy: 'M' | 'F' | 'BOTH') {
  return genderPolicy === 'BOTH' || genderPolicy === gender;
}

function emptyLifestyle(): LifestyleData {
  return Object.fromEntries(lifestyleFieldNames.map((field) => [field, null])) as LifestyleData;
}

import { Inject, Injectable } from '@nestjs/common';
import type {
  ActiveMatchActionResponse,
  ActiveMatchResponse,
  ActiveMatchSummary,
  CreateMatchRequestRequest,
  MatchHistoryResponse,
  MatchRequestActionResponse,
  MatchRequestListResponse,
} from '@repo/shared/match-contract';
import type { PublicProfile } from '@repo/shared/profile-contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { Prisma } from '../generated/prisma/client.js';
import type { Campus } from '../generated/prisma/enums.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import {
  CHAT_MATCH_THREAD_LIFECYCLE_PORT,
  type ChatMatchThreadLifecyclePort,
} from '../chat/application/ports/chat-match-thread-lifecycle.port.js';
import { lifestyleColumnSelect } from '../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { createMatchContextOwner } from './match-context-owner.js';
import { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { matchesErrors } from './matches.errors.js';
import { createMatchActiveQueryOwner } from './match-active-query-owner.js';
import { createMatchHistoryMaterializationOwner } from './match-history-materialization-owner.js';
import { createMatchHistoryReadOwner } from './match-history-read-owner.js';
import { createMatchLifecycleOwner } from './match-lifecycle-owner.js';
import { toDetailedActiveMatchSummary, toMatchRequestSummary } from './match-read-model.js';
import {
  createMatchRequestPreparationOwner,
  type PreparedMatchRequestCreation,
} from './match-request-preparation.js';
import { createMatchRequestCommandCluster } from './match-request-command-cluster.js';
import {
  executeAcceptMatchRequest,
  executeTerminalMatchRequestUpdate,
  getRequestTerminalNotAllowedError,
  loadAcceptableMatchRequest,
  loadTerminableMatchRequest,
} from './match-request-step-owner.js';
import { activeMatchCommandSelect, matchRequestSummarySelect } from './match-selects.js';
import {
  acquireActiveMatchLock,
  acquirePairLock,
  acquireParticipantLocks,
  assertDirectionCooldown,
  assertDirectionLimit,
  assertNoLiveActiveMatchForParticipants,
  assertNoLivePendingPair,
  assertPendingRequestLimit,
  expireDuePendingRequests,
  lockActiveMatchRow,
} from './match-transaction-helpers.js';
import { createMatchUnmatchCommandCluster } from './match-unmatch-command-cluster.js';
import {
  loadValidatedActiveMatchForUnmatch,
  reloadActiveMatchOrThrow,
  synchronizePendingUnmatchRequests,
} from './match-unmatch-support.js';
import { resolveMatchRequestExpiresAt } from './match.utils.js';
import { formatKstDate } from '../platform/time/kst-date.js';
import { parseLifestyleOrNull } from '../profiles/profile.mapper.js';

interface LifecycleTransitionResult {
  expiredUnmatchRequests: number;
  seasonEndedActiveMatch: boolean;
}

const matchRequestCreationParticipantSelect = {
  id: true,
  registeredAt: true,
  dormitoryId: true,
  dormitorySelectionState: true,
  participationIntent: true,
  participantStatus: true,
  declinedAt: true,
  withdrawnAt: true,
  hiddenByAdminAt: true,
  deactivatedAt: true,
  user: {
    select: {
      deletedAt: true,
    },
  },
  profile: {
    select: lifestyleColumnSelect,
  },
} as const satisfies Prisma.SeasonParticipantSelect;

type MatchRequestCreationParticipant = Prisma.SeasonParticipantGetPayload<{
  select: typeof matchRequestCreationParticipantSelect;
}>;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(CHAT_MATCH_THREAD_LIFECYCLE_PORT)
    private readonly chatMatchThreadLifecycle: ChatMatchThreadLifecyclePort,
  ) {}

  private get requestCommandCluster() {
    return createMatchRequestCommandCluster({
      getDatabaseNow: () => this.prisma.getDatabaseNow(),
      runSerializableTransaction: (callback) => this.prisma.runSerializableTransaction(callback),
      prepareMatchRequestCreation: (requesterUserId, input, now) =>
        this.requestPreparationOwner.prepareMatchRequestCreation(requesterUserId, input, now),
      createPendingMatchRequest: (tx, input, now) => this.createPendingMatchRequest(tx, input, now),
      getCurrentMatchContext: (userId, now) =>
        this.contextOwner.getCurrentMatchContext(userId, now),
      expireDuePendingRequests: (seasonId, now, tx) =>
        expireDuePendingRequests(tx ?? this.prisma, seasonId, now),
      loadAcceptableMatchRequest,
      executeAcceptMatchRequest: (tx, input, now) =>
        executeAcceptMatchRequest(tx, this.chatMatchThreadLifecycle, input, now),
      getDetailedActiveMatchSummaryForViewer: (
        client,
        activeMatchId,
        viewerParticipantId,
        seasonContext,
        now,
      ) =>
        this.activeQueryOwner.getDetailedActiveMatchSummaryForViewer(
          client,
          activeMatchId,
          viewerParticipantId,
          seasonContext,
          now,
        ),
      getRequestTerminalNotAllowedError,
      loadTerminableMatchRequest,
      executeTerminalMatchRequestUpdate,
    });
  }

  private get lifecycleOwner() {
    return createMatchLifecycleOwner({
      prisma: this.prisma,
      getSeasonContextForCampus: (cache, campusCode, now) =>
        this.getSeasonContextForCampus(cache, campusCode, now),
      transitionActiveMatchLifecycle: (activeMatchId, seasonContext, now) =>
        this.transitionActiveMatchLifecycle(activeMatchId, seasonContext, now),
    });
  }

  private get contextOwner() {
    return createMatchContextOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      requestTargetNotFound: () => matchesErrors.requestTargetNotFound(),
      requestSelfTargetNotAllowed: () => matchesErrors.requestSelfTargetNotAllowed(),
    });
  }

  private get activeQueryOwner() {
    return createMatchActiveQueryOwner(this.prisma);
  }

  private get requestPreparationOwner() {
    return createMatchRequestPreparationOwner({
      getCurrentMatchContext: (userId, now) =>
        this.contextOwner.getCurrentMatchContext(userId, now),
      getValidatedTargetUserForMatchRequest: (targetUserId, requesterUser) =>
        this.contextOwner.getValidatedTargetUserForMatchRequest(targetUserId, requesterUser),
      findRoomSelectionDate: (seasonContext, dormitoryId) =>
        this.contextOwner.findRoomSelectionDate(seasonContext, dormitoryId),
      getLiveActiveMatchMapForParticipantIds: (seasonId, participantIds) =>
        this.activeQueryOwner.getLiveActiveMatchMapForParticipantIds(seasonId, participantIds),
      seasonParticipantsService: this.seasonParticipantsService,
      moderationService: this.moderationService,
    });
  }

  private get unmatchCommandCluster() {
    return createMatchUnmatchCommandCluster({
      getDatabaseNow: () => this.prisma.getDatabaseNow(),
      runSerializableTransaction: (callback) => this.prisma.runSerializableTransaction(callback),
      getCurrentMatchContext: (userId, now) =>
        this.contextOwner.getCurrentMatchContext(userId, now),
      loadValidatedActiveMatchForUnmatch,
      reloadActiveMatchOrThrow,
      handleActiveMatchUnmatched: (tx, input, now) =>
        this.chatMatchThreadLifecycle.handleActiveMatchUnmatched(tx, input, now),
    });
  }

  private get historyMaterializationOwner() {
    return createMatchHistoryMaterializationOwner(this.prisma);
  }

  private get historyReadOwner() {
    return createMatchHistoryReadOwner(this.prisma);
  }

  async getCurrentActiveMatch(authUser: AuthenticatedUserContext): Promise<ActiveMatchResponse> {
    const now = await this.prisma.getDatabaseNow();
    const context = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!context?.seasonContext || !context.participant) {
      return { activeMatch: null };
    }

    return {
      activeMatch: await this.getCurrentActiveMatchSummaryForParticipant(
        context.seasonContext,
        context.participant.id,
        now,
      ),
    };
  }

  async listCurrentSeasonRequests(
    authUser: AuthenticatedUserContext,
  ): Promise<MatchRequestListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const context = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!context?.seasonContext || !context.participant) {
      return { items: [] };
    }

    await expireDuePendingRequests(this.prisma, context.seasonContext.season.id, now);

    const requests = await this.prisma.matchRequest.findMany({
      where: {
        seasonId: context.seasonContext.season.id,
        OR: [
          { requesterParticipantId: context.participant.id },
          { receiverParticipantId: context.participant.id },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: matchRequestSummarySelect,
    });

    return {
      items: requests.map((request) => toMatchRequestSummary(request, context.participant!.id)),
    };
  }

  async getMatchHistory(authUser: AuthenticatedUserContext): Promise<MatchHistoryResponse> {
    const now = await this.prisma.getDatabaseNow();
    await this.historyMaterializationOwner.materializeEndedSeasonHistory(now, authUser.id);
    return this.historyReadOwner.listPastSeasonHistoryForUser(authUser.id, now);
  }

  async getMatchHistoryCounterpartProfile(
    authUser: AuthenticatedUserContext,
    entryId: string,
  ): Promise<PublicProfile> {
    const now = await this.prisma.getDatabaseNow();
    await this.historyMaterializationOwner.materializeEndedSeasonHistory(now, authUser.id);
    return this.historyReadOwner.getFinalCounterpartProfileForEntry(authUser.id, entryId, now);
  }

  async createMatchRequest(
    authUser: AuthenticatedUserContext,
    input: CreateMatchRequestRequest,
  ): Promise<MatchRequestActionResponse> {
    return this.requestCommandCluster.createMatchRequest(authUser, input);
  }

  async acceptMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.requestCommandCluster.acceptMatchRequest(authUser, requestId);
  }

  async rejectMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.requestCommandCluster.rejectMatchRequest(authUser, requestId);
  }

  async cancelMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.requestCommandCluster.cancelMatchRequest(authUser, requestId);
  }

  async requestUnmatch(
    authUser: AuthenticatedUserContext,
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    return this.unmatchCommandCluster.requestUnmatch(authUser, activeMatchId);
  }

  async cancelUnmatchRequest(
    authUser: AuthenticatedUserContext,
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    return this.unmatchCommandCluster.cancelUnmatchRequest(authUser, activeMatchId);
  }

  async getCurrentActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchSummary | null> {
    const activeMatchMap = await this.getLiveActiveMatchMapForParticipantIds(seasonId, [
      participantId,
    ]);
    return activeMatchMap.get(participantId) ?? null;
  }

  async getCurrentActiveMatchSummaryForParticipant(
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    participantId: string,
    now: Date,
  ): Promise<ActiveMatchSummary | null> {
    const activeMatch = await this.activeQueryOwner.getCurrentDetailedActiveMatchByParticipantId(
      seasonContext.season.id,
      participantId,
    );
    if (!activeMatch) return null;
    const synchronizedActiveMatch = await synchronizePendingUnmatchRequests(
      this.prisma,
      activeMatch,
      seasonContext,
      now,
    );
    return toDetailedActiveMatchSummary(synchronizedActiveMatch, participantId, seasonContext, now);
  }

  async sweepLifecycleTransitions(now: Date) {
    return this.lifecycleOwner.sweepLifecycleTransitions(now);
  }

  async sweepHistoryMaterialization(now: Date) {
    return this.historyMaterializationOwner.materializeEndedSeasonHistory(now);
  }

  async getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>> {
    return this.activeQueryOwner.getLiveActiveMatchMapForParticipantIds(seasonId, participantIds);
  }

  private async getSeasonContextForCampus(
    cache: Map<Campus, Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    campusCode: Campus,
    now: Date,
  ) {
    const cachedSeasonContext = cache.get(campusCode);
    if (cachedSeasonContext !== undefined) {
      return cachedSeasonContext;
    }

    const seasonContext = await this.seasonsService.getCurrentSeasonContext(campusCode, now);
    cache.set(campusCode, seasonContext);
    return seasonContext;
  }

  private async transitionActiveMatchLifecycle(
    activeMatchId: string,
    seasonContext: Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>,
    now: Date,
  ): Promise<LifecycleTransitionResult> {
    return this.prisma.runSerializableTransaction(async (tx) => {
      await acquireActiveMatchLock(tx, activeMatchId);
      await lockActiveMatchRow(tx, activeMatchId);

      const currentActiveMatch = await tx.activeMatch.findUnique({
        where: { id: activeMatchId },
        select: activeMatchCommandSelect,
      });

      if (!currentActiveMatch || currentActiveMatch.status !== 'ACTIVE') {
        return { expiredUnmatchRequests: 0, seasonEndedActiveMatch: false };
      }

      const pendingBefore = currentActiveMatch.unmatchRequests.filter(
        (request) => request.status === 'PENDING',
      ).length;
      const shouldSeasonEnd =
        !seasonContext || seasonContext.season.id !== currentActiveMatch.seasonId;

      if (shouldSeasonEnd) {
        return this.endSeasonForActiveMatch(tx, currentActiveMatch.id, pendingBefore, now);
      }

      if (pendingBefore === 0) {
        return { expiredUnmatchRequests: 0, seasonEndedActiveMatch: false };
      }

      const synchronizedActiveMatch = await synchronizePendingUnmatchRequests(
        tx,
        currentActiveMatch,
        seasonContext,
        now,
      );
      const pendingAfter = synchronizedActiveMatch.unmatchRequests.filter(
        (request) => request.status === 'PENDING',
      ).length;

      return {
        expiredUnmatchRequests: pendingBefore - pendingAfter,
        seasonEndedActiveMatch: false,
      };
    });
  }

  private async endSeasonForActiveMatch(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
    pendingBefore: number,
    now: Date,
  ): Promise<LifecycleTransitionResult> {
    const expiredPendingRequests = pendingBefore
      ? await tx.activeMatchUnmatchRequest.updateMany({
          where: {
            activeMatchId,
            status: 'PENDING',
          },
          data: {
            status: 'EXPIRED_BY_CUTOFF',
            terminalAt: now,
          },
        })
      : { count: 0 };

    await tx.activeMatch.update({
      where: { id: activeMatchId },
      data: {
        status: 'SEASON_ENDED',
        endedAt: now,
        endReason: 'SEASON_ENDED',
      },
    });

    return {
      expiredUnmatchRequests: expiredPendingRequests.count,
      seasonEndedActiveMatch: true,
    };
  }

  private async createPendingMatchRequest(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreation,
    now: Date,
  ) {
    await this.assertCanCreatePendingMatchRequest(tx, input, now);

    try {
      return await tx.matchRequest.create({
        data: {
          seasonId: input.seasonId,
          pairKey: input.pairIdentity.pairKey,
          pairMinParticipantId: input.pairIdentity.pairMinParticipantId,
          pairMaxParticipantId: input.pairIdentity.pairMaxParticipantId,
          requesterParticipantId: input.requesterParticipantId,
          receiverParticipantId: input.receiverParticipantId,
          note: input.note,
          status: 'PENDING',
          expiresAt: resolveMatchRequestExpiresAt(now, input.requesterRoomSelectionDate),
        },
        select: matchRequestSummarySelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw matchesErrors.requestAlreadyPending();
      }
      throw error;
    }
  }

  private async assertCanCreatePendingMatchRequest(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreation,
    now: Date,
  ) {
    await acquirePairLock(tx, input.seasonId, input.pairIdentity.pairKey);
    const sortedParticipants = [
      input.pairIdentity.pairMinParticipantId,
      input.pairIdentity.pairMaxParticipantId,
    ] as const;
    await acquireParticipantLocks(tx, input.seasonId, sortedParticipants);
    await this.assertPreparedParticipantsStillRequestable(tx, input, sortedParticipants, now);
    await expireDuePendingRequests(tx, input.seasonId, now);
    await assertNoLivePendingPair(tx, input.seasonId, input.pairIdentity);
    await assertNoLiveActiveMatchForParticipants(tx, input.seasonId, sortedParticipants);
    await assertPendingRequestLimit(tx, input.seasonId, input.requesterParticipantId);
    await assertDirectionLimit(
      tx,
      input.seasonId,
      input.requesterParticipantId,
      input.receiverParticipantId,
    );
    await assertDirectionCooldown(
      tx,
      input.seasonId,
      input.requesterParticipantId,
      input.receiverParticipantId,
      now,
    );
  }

  private async assertPreparedParticipantsStillRequestable(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreation,
    sortedParticipantIds: readonly [string, string],
    now: Date,
  ) {
    const participants = await tx.seasonParticipant.findMany({
      where: {
        seasonId: input.seasonId,
        id: { in: [input.requesterParticipantId, input.receiverParticipantId] },
      },
      select: matchRequestCreationParticipantSelect,
    });
    const participantById = new Map(
      participants.map((participant) => [participant.id, participant]),
    );
    const requester = participantById.get(input.requesterParticipantId);
    const receiver = participantById.get(input.receiverParticipantId);
    if (
      !requester ||
      !receiver ||
      !isMatchRequestCreationParticipantReady(requester) ||
      !isMatchRequestCreationParticipantReady(receiver) ||
      requester.dormitoryId === null ||
      requester.dormitoryId !== receiver.dormitoryId
    ) {
      throw matchesErrors.requestNotAllowed();
    }

    const [operation, snapshotCount] = await Promise.all([
      tx.seasonDormitoryOperation.findUnique({
        where: {
          seasonId_dormitoryId: {
            seasonId: input.seasonId,
            dormitoryId: requester.dormitoryId,
          },
        },
        select: {
          isOperated: true,
          roomSelectionDate: true,
        },
      }),
      tx.seasonParticipantProfileHistory.count({
        where: {
          seasonId: input.seasonId,
          participantId: { in: [input.requesterParticipantId, input.receiverParticipantId] },
          source: 'SEASON_REGISTRATION',
          registeredAtSnapshot: { not: null },
          redactedAt: null,
        },
      }),
    ]);

    if (
      !operation?.isOperated ||
      formatKstDate(now) > formatKstDate(operation.roomSelectionDate) ||
      snapshotCount !== 2
    ) {
      throw matchesErrors.requestNotAllowed();
    }
  }
}

function isMatchRequestCreationParticipantReady(participant: MatchRequestCreationParticipant) {
  const lifestyle = parseLifestyleOrNull(participant.profile ?? null);

  return (
    participant.participationIntent === 'REGISTERED' &&
    participant.registeredAt !== null &&
    participant.dormitorySelectionState === 'ASSIGNED' &&
    participant.dormitoryId !== null &&
    participant.declinedAt === null &&
    participant.withdrawnAt === null &&
    participant.participantStatus !== 'WITHDRAWN' &&
    participant.participantStatus !== 'EXPIRED' &&
    participant.hiddenByAdminAt === null &&
    participant.deactivatedAt === null &&
    participant.user.deletedAt === null &&
    lifestyle !== null &&
    isSeasonProfileComplete(lifestyle)
  );
}

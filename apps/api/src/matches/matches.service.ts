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
import { Prisma } from '../generated/prisma/client.js';
import type { Campus } from '../generated/prisma/enums.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { createMatchContextOwner } from './match-context-owner.js';
import { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../seasons/ports/season-context.port.js';
import { ActiveMatchViewQuery } from './active/queries/active-match-view.query.js';
import type {
  MatchHistoryMaterializationPort,
  MatchHistoryMaterializationResult,
} from './application/ports/match-history-materialization.port.js';
import type {
  MatchLifecycleSweepPort,
  MatchLifecycleSweepResult,
} from './application/ports/match-lifecycle-sweep.port.js';
import { matchesErrors } from './matches.errors.js';
import { createMatchHistoryMaterializationOwner } from './match-history-materialization-owner.js';
import { createMatchHistoryReadOwner } from './match-history-read-owner.js';
import { createMatchLifecycleOwner } from './match-lifecycle-owner.js';
import { CancelUnmatchRequestCommand } from './active/commands/cancel-unmatch-request.command.js';
import { RequestUnmatchCommand } from './active/commands/request-unmatch.command.js';
import { ActiveMatchRepository } from './active/persistence/active-match.repository.js';
import { AcceptMatchRequestCommand } from './requests/commands/accept-match-request.command.js';
import { CreateMatchRequestCommand } from './requests/commands/create-match-request.command.js';
import { RejectMatchRequestCommand } from './requests/commands/reject-match-request.command.js';
import { CancelMatchRequestCommand } from './requests/commands/cancel-match-request.command.js';
import { ListCurrentSeasonRequestsQuery } from './requests/queries/list-current-season-requests.query.js';

interface LifecycleTransitionResult {
  expiredUnmatchRequests: number;
  seasonEndedActiveMatch: boolean;
}

@Injectable()
export class MatchesService implements MatchLifecycleSweepPort, MatchHistoryMaterializationPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly activeMatchViewQuery: ActiveMatchViewQuery,
    private readonly listCurrentSeasonRequestsQuery: ListCurrentSeasonRequestsQuery,
    private readonly createMatchRequestCommand: CreateMatchRequestCommand,
    private readonly acceptMatchRequestCommand: AcceptMatchRequestCommand,
    private readonly rejectMatchRequestCommand: RejectMatchRequestCommand,
    private readonly cancelMatchRequestCommand: CancelMatchRequestCommand,
    private readonly requestUnmatchCommand: RequestUnmatchCommand,
    private readonly cancelUnmatchRequestCommand: CancelUnmatchRequestCommand,
    private readonly activeMatchRepository: ActiveMatchRepository,
  ) {}

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
    return this.listCurrentSeasonRequestsQuery.execute(authUser);
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
    return this.createMatchRequestCommand.execute(authUser, input);
  }

  async acceptMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.acceptMatchRequestCommand.execute(authUser, requestId);
  }

  async rejectMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.rejectMatchRequestCommand.execute(authUser, requestId);
  }

  async cancelMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.cancelMatchRequestCommand.execute(authUser, requestId);
  }

  async requestUnmatch(
    authUser: AuthenticatedUserContext,
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    return this.requestUnmatchCommand.execute(authUser, activeMatchId);
  }

  async cancelUnmatchRequest(
    authUser: AuthenticatedUserContext,
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    return this.cancelUnmatchRequestCommand.execute(authUser, activeMatchId);
  }

  async getCurrentActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchSummary | null> {
    return this.activeMatchViewQuery.getCurrentActiveMatchByParticipantId(seasonId, participantId);
  }

  async getCurrentActiveMatchSummaryForParticipant(
    seasonContext: CurrentSeasonContext,
    participantId: string,
    now: Date,
  ): Promise<ActiveMatchSummary | null> {
    return this.activeMatchViewQuery.getCurrentActiveMatchSummaryForParticipant(
      seasonContext,
      participantId,
      now,
    );
  }

  async sweepLifecycleTransitions(now: Date): Promise<MatchLifecycleSweepResult> {
    return this.sweepMatchLifecycleTransitions(now);
  }

  async sweepMatchLifecycleTransitions(now: Date): Promise<MatchLifecycleSweepResult> {
    return this.lifecycleOwner.sweepLifecycleTransitions(now);
  }

  async sweepHistoryMaterialization(now: Date): Promise<MatchHistoryMaterializationResult> {
    return this.materializeEndedSeasonHistory(now);
  }

  async materializeEndedSeasonHistory(
    now: Date,
    userId?: string,
  ): Promise<MatchHistoryMaterializationResult> {
    return this.historyMaterializationOwner.materializeEndedSeasonHistory(now, userId);
  }

  async materializeSeasonHistoryById(
    seasonId: string,
    now: Date,
  ): Promise<MatchHistoryMaterializationResult> {
    return this.historyMaterializationOwner.materializeSeasonHistoryById(seasonId, now);
  }

  async getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>> {
    return this.activeMatchViewQuery.getLiveActiveMatchMapForParticipantIds(
      seasonId,
      participantIds,
    );
  }

  private async getSeasonContextForCampus(
    cache: Map<Campus, Awaited<ReturnType<SeasonContextPort['getCurrentSeasonContext']>>>,
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
    seasonContext: Awaited<ReturnType<SeasonContextPort['getCurrentSeasonContext']>>,
    now: Date,
  ): Promise<LifecycleTransitionResult> {
    return this.prisma.runSerializableTransaction(async (tx) => {
      const currentActiveMatch = await this.activeMatchRepository.lockAndFindActiveMatch(
        tx,
        activeMatchId,
      );

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

      const synchronizedActiveMatch =
        await this.activeMatchRepository.synchronizePendingUnmatchRequests(
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
}

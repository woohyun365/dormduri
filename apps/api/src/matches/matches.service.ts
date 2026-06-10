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
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { createMatchContextOwner } from './context/match-context.resolver.js';
import { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../seasons/ports/season-context.port.js';
import { ActiveMatchViewQuery } from './active/queries/active-match-view.query.js';
import { matchesErrors } from './matches.errors.js';
import { MatchHistoryMaterializationService } from './history/application/match-history-materialization.service.js';
import { MatchHistoryQueryService } from './history/application/match-history-query.service.js';
import { CancelUnmatchRequestCommand } from './active/commands/cancel-unmatch-request.command.js';
import { RequestUnmatchCommand } from './active/commands/request-unmatch.command.js';
import { AcceptMatchRequestCommand } from './requests/commands/accept-match-request.command.js';
import { CreateMatchRequestCommand } from './requests/commands/create-match-request.command.js';
import { RejectMatchRequestCommand } from './requests/commands/reject-match-request.command.js';
import { CancelMatchRequestCommand } from './requests/commands/cancel-match-request.command.js';
import { ListCurrentSeasonRequestsQuery } from './requests/queries/list-current-season-requests.query.js';

@Injectable()
export class MatchesService {
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
    private readonly matchHistoryMaterializationService: MatchHistoryMaterializationService,
    private readonly matchHistoryQueryService: MatchHistoryQueryService,
  ) {}

  private get contextOwner() {
    return createMatchContextOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      requestTargetNotFound: () => matchesErrors.requestTargetNotFound(),
      requestSelfTargetNotAllowed: () => matchesErrors.requestSelfTargetNotAllowed(),
    });
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
    await this.matchHistoryMaterializationService.materializeEndedSeasonHistory(now, authUser.id);
    return this.matchHistoryQueryService.listPastSeasonHistoryForUser(authUser.id, now);
  }

  async getMatchHistoryCounterpartProfile(
    authUser: AuthenticatedUserContext,
    entryId: string,
  ): Promise<PublicProfile> {
    const now = await this.prisma.getDatabaseNow();
    await this.matchHistoryMaterializationService.materializeEndedSeasonHistory(now, authUser.id);
    return this.matchHistoryQueryService.getFinalCounterpartProfileForEntry(
      authUser.id,
      entryId,
      now,
    );
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

  async getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>> {
    return this.activeMatchViewQuery.getLiveActiveMatchMapForParticipantIds(
      seasonId,
      participantIds,
    );
  }
}

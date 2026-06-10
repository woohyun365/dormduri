import { Inject, Injectable } from '@nestjs/common';
import type { MatchRequestActionResponse } from '@repo/shared/match-contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import {
  CHAT_MATCH_THREAD_LIFECYCLE_PORT,
  type ChatMatchThreadLifecyclePort,
} from '../../../chat/application/ports/chat-match-thread-lifecycle.port.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { ActiveMatchViewQuery } from '../../active/queries/active-match-view.query.js';
import { createMatchContextOwner } from '../../context/match-context.resolver.js';
import { matchesErrors } from '../../matches.errors.js';
import { expireDuePendingRequests } from '../persistence/match-request-locks.js';
import { MatchRequestAcceptanceRepository } from '../persistence/match-request-acceptance.repository.js';
import { toMatchRequestSummary } from '../presenters/match-request.presenter.js';

@Injectable()
export class AcceptMatchRequestCommand {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(CHAT_MATCH_THREAD_LIFECYCLE_PORT)
    private readonly chatMatchThreadLifecycle: ChatMatchThreadLifecyclePort,
    private readonly activeMatchViewQuery: ActiveMatchViewQuery,
    private readonly acceptanceRepository: MatchRequestAcceptanceRepository,
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

  async execute(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const receiverContext = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!receiverContext?.seasonContext || !receiverContext.participant) {
      throw matchesErrors.requestRejectNotAllowed();
    }
    const receiverParticipantId = receiverContext.participant.id;
    const receiverSeasonContext = receiverContext.seasonContext;

    return this.prisma.runSerializableTransaction(async (tx) => {
      await expireDuePendingRequests(tx, receiverSeasonContext.season.id, now);
      const acceptanceContext = await this.acceptanceRepository.lockAndLoadAcceptableRequest(
        tx,
        requestId,
        receiverParticipantId,
        now,
        receiverSeasonContext,
      );

      if (acceptanceContext.kind === 'TERMINAL') {
        return {
          request: toMatchRequestSummary(acceptanceContext.request, receiverParticipantId),
          activeMatch: null,
        };
      }

      const { acceptedRequest, activeMatchRecord } =
        await this.acceptanceRepository.acceptRequestAndCreateActiveMatch(
          tx,
          acceptanceContext,
          now,
        );

      await this.chatMatchThreadLifecycle.handleActiveMatchCreated(
        tx,
        {
          seasonId: acceptedRequest.seasonId,
          pairKey: acceptanceContext.pairIdentity.pairKey,
          participantAId: acceptanceContext.pairIdentity.pairMinParticipantId,
          participantBId: acceptanceContext.pairIdentity.pairMaxParticipantId,
          activeMatchId: activeMatchRecord.id,
        },
        now,
      );

      await this.acceptanceRepository.cancelOtherPendingRequestsAfterActiveMatch(
        tx,
        acceptedRequest,
        now,
      );

      const activeMatchSummary =
        await this.activeMatchViewQuery.getDetailedActiveMatchSummaryForViewer(
          tx,
          activeMatchRecord.id,
          receiverParticipantId,
          receiverSeasonContext,
          now,
        );

      return {
        request: toMatchRequestSummary(acceptedRequest, receiverParticipantId),
        activeMatch: activeMatchSummary,
      };
    });
  }
}

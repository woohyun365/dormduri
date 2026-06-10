import { Inject, Injectable } from '@nestjs/common';
import type { ActiveMatchActionResponse } from '@repo/shared/match-contract';
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
import { createMatchContextOwner } from '../../context/match-context.resolver.js';
import { toDetailedActiveMatchSummary } from '../presenters/active-match.presenter.js';
import { matchesErrors } from '../../matches.errors.js';
import {
  assertUnmatchActorAllowed,
  findViewerPendingUnmatchRequest,
} from '../policies/active-match-unmatch.policy.js';
import { ActiveMatchLifecycleEventWriter } from '../lifecycle-events/active-match-lifecycle-event.writer.js';
import { ActiveMatchRepository } from '../persistence/active-match.repository.js';

@Injectable()
export class RequestUnmatchCommand {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(CHAT_MATCH_THREAD_LIFECYCLE_PORT)
    private readonly chatMatchThreadLifecycle: ChatMatchThreadLifecyclePort,
    private readonly activeMatchRepository: ActiveMatchRepository,
    private readonly lifecycleEventWriter: ActiveMatchLifecycleEventWriter,
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
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const currentContext = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!currentContext?.seasonContext || !currentContext.participant) {
      throw matchesErrors.unmatchRequestNotAllowed();
    }

    const participantId = currentContext.participant.id;
    const seasonContext = currentContext.seasonContext;

    return this.prisma.runSerializableTransaction(async (tx) => {
      const synchronizedActiveMatch =
        await this.activeMatchRepository.loadValidatedActiveMatchForUnmatch(
          tx,
          activeMatchId,
          seasonContext,
          now,
        );

      assertUnmatchActorAllowed(synchronizedActiveMatch, participantId, () =>
        matchesErrors.unmatchRequestNotAllowed(),
      );

      if (findViewerPendingUnmatchRequest(synchronizedActiveMatch, participantId)) {
        throw matchesErrors.unmatchRequestAlreadySubmitted();
      }

      const createdUnmatchRequest = await this.activeMatchRepository.createPendingUnmatchRequest(
        tx,
        synchronizedActiveMatch.id,
        participantId,
        now,
      );

      await this.lifecycleEventWriter.recordUnmatchRequested(tx, {
        activeMatchId: synchronizedActiveMatch.id,
        actorUserId: authUser.id,
        sourceUnmatchRequestId: createdUnmatchRequest.id,
        occurredAt: now,
        metadata: {
          transitionOwner: 'match.unmatch.request',
          previousStatus: 'ACTIVE',
          nextStatus: 'ACTIVE',
          unmatchRequestStatus: createdUnmatchRequest.status,
        },
      });

      const pendingUnmatchRequests = await this.activeMatchRepository.findPendingUnmatchRequests(
        tx,
        synchronizedActiveMatch.id,
      );

      if (pendingUnmatchRequests.length < 2) {
        const refreshedActiveMatch = await this.activeMatchRepository.reloadActiveMatchOrThrow(
          tx,
          synchronizedActiveMatch.id,
        );

        return {
          activeMatch: toDetailedActiveMatchSummary(
            refreshedActiveMatch,
            participantId,
            seasonContext,
            now,
          ),
        };
      }

      const endedActiveMatch = await this.activeMatchRepository.fulfillMutualUnmatch(
        tx,
        synchronizedActiveMatch,
        now,
      );

      await this.chatMatchThreadLifecycle.handleActiveMatchUnmatched(
        tx,
        { activeMatchId: synchronizedActiveMatch.id },
        now,
      );

      await this.lifecycleEventWriter.recordUnmatched(tx, {
        activeMatchId: synchronizedActiveMatch.id,
        actorUserId: authUser.id,
        sourceUnmatchRequestId: createdUnmatchRequest.id,
        occurredAt: now,
        metadata: {
          transitionOwner: 'match.unmatch.mutual',
          previousStatus: 'ACTIVE',
          nextStatus: endedActiveMatch.status,
          previousEndReason: null,
          nextEndReason: endedActiveMatch.endReason,
          unmatchRequestStatus: 'FULFILLED_BY_MUTUAL_CONSENT',
          chatMatchedThreadUpdated: { attempted: true },
          chatDirectThreadsReopened: { attempted: true, exactCountKnown: false },
        },
      });

      return {
        activeMatch: toDetailedActiveMatchSummary(
          endedActiveMatch,
          participantId,
          seasonContext,
          now,
        ),
      };
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { ActiveMatchActionResponse } from '@repo/shared/match-contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { createMatchContextOwner } from '../../match-context-owner.js';
import { toDetailedActiveMatchSummary } from '../../match-read-model.js';
import { matchesErrors } from '../../matches.errors.js';
import { ActiveMatchRepository } from '../persistence/active-match.repository.js';

@Injectable()
export class CancelUnmatchRequestCommand {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly activeMatchRepository: ActiveMatchRepository,
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
      throw matchesErrors.unmatchRequestCancelNotAllowed();
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
      const viewerPendingRequest = await this.activeMatchRepository.findViewerPendingUnmatchRequest(
        tx,
        synchronizedActiveMatch.id,
        participantId,
      );

      if (!viewerPendingRequest) {
        throw matchesErrors.unmatchRequestCancelNotAllowed();
      }

      await this.activeMatchRepository.cancelViewerPendingUnmatchRequest(
        tx,
        viewerPendingRequest.id,
        now,
      );

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
    });
  }
}

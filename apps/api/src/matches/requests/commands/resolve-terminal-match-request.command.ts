import { Inject, Injectable } from '@nestjs/common';
import type { MatchRequestActionResponse } from '@repo/shared/match-contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { createMatchContextOwner } from '../../context/match-context.resolver.js';
import { toMatchRequestSummary } from '../presenters/match-request.presenter.js';
import { matchesErrors } from '../../matches.errors.js';
import {
  MatchRequestRepository,
  getRequestTerminalNotAllowedError,
} from '../persistence/match-request.repository.js';
import { expireDuePendingRequests } from '../persistence/match-request-locks.js';
import type {
  TerminalMatchRequestReason,
  TerminalMatchRequestStatus,
} from '../policies/match-request-terminal.policy.js';

@Injectable()
export class ResolveTerminalMatchRequestCommand {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchRequestRepository: MatchRequestRepository,
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
    status: TerminalMatchRequestStatus,
    terminalReason: TerminalMatchRequestReason,
  ): Promise<MatchRequestActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const currentContext = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!currentContext?.seasonContext || !currentContext.participant) {
      throw getRequestTerminalNotAllowedError(status);
    }
    const actingParticipantId = currentContext.participant.id;
    const currentSeasonContext = currentContext.seasonContext;

    return this.prisma.runSerializableTransaction(async (tx) => {
      await expireDuePendingRequests(tx, currentSeasonContext.season.id, now);
      const request = await this.matchRequestRepository.loadTerminableMatchRequest(
        tx,
        requestId,
        actingParticipantId,
        status,
        now,
      );
      const updatedRequest = await this.matchRequestRepository.executeTerminalMatchRequestUpdate(
        tx,
        request,
        status,
        terminalReason,
        now,
      );

      return {
        request: toMatchRequestSummary(updatedRequest, actingParticipantId),
        activeMatch: null,
      };
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { MatchRequestListResponse } from '@repo/shared/match-contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { createMatchContextOwner } from '../../match-context-owner.js';
import { toMatchRequestSummary } from '../presenters/match-request.presenter.js';
import { matchRequestSummarySelect } from '../persistence/match-request.select.js';
import { matchesErrors } from '../../matches.errors.js';
import { expireDuePendingRequests } from '../persistence/match-request-locks.js';

@Injectable()
export class ListCurrentSeasonRequestsQuery {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
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

  async execute(authUser: AuthenticatedUserContext): Promise<MatchRequestListResponse> {
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
}

import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import type {
  RoommateSearchManifestQuery,
  RoommateSearchManifestResponse,
  RoommateSearchQuery,
  RoommateSearchResponse,
} from '@repo/shared/roommate-search-contract';
import { PrismaService } from '../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../seasons/ports/season-context.port.js';
import { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import {
  MATCH_ACTIVE_VIEW_PORT,
  type MatchActiveViewPort,
} from '../matches/application/ports/match-active-view.port.js';
import {
  MATCH_SCORE_PROJECTION_PORT,
  type MatchScoreProjectionPort,
} from '../matches/application/ports/match-score-projection.port.js';
import { createRoommateSearchOwner } from './roommate-search-owner.js';

@Injectable()
export class RoommateSearchService {
  private readonly searchOwner;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(MATCH_ACTIVE_VIEW_PORT)
    private readonly matchActiveView: MatchActiveViewPort,
    @Inject(MATCH_SCORE_PROJECTION_PORT)
    private readonly matchScoreProjection: MatchScoreProjectionPort,
  ) {
    this.searchOwner = createRoommateSearchOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      matchActiveView: this.matchActiveView,
      matchScoreProjection: this.matchScoreProjection,
    });
  }

  async search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    return this.searchOwner.search(authUser, query);
  }

  async getManifest(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchManifestQuery,
  ): Promise<RoommateSearchManifestResponse> {
    return this.searchOwner.getManifest(authUser, query);
  }
}

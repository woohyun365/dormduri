import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import type {
  RoommateSearchManifestQuery,
  RoommateSearchManifestResponse,
  RoommateSearchQuery,
  RoommateSearchResponse,
} from '@repo/shared/roommate-search-contract';
import { PrismaService } from '../platform/database/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { createRoommateSearchOwner } from './roommate-search-owner.js';

@Injectable()
export class RoommateSearchService {
  private readonly searchOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchesService: MatchesService,
  ) {
    this.searchOwner = createRoommateSearchOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      matchesService: this.matchesService,
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

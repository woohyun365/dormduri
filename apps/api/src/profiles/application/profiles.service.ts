import { Inject, Injectable } from '@nestjs/common';
import type { PublicProfile } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  BLOCK_VISIBILITY_READER_PORT,
  type BlockVisibilityReaderPort,
} from '../../social-safety/blocks/application/ports/block-visibility-reader.port.js';
import {
  MATCH_ACTIVE_VIEW_PORT,
  type MatchActiveViewPort,
} from '../../matches/application/ports/match-active-view.port.js';
import {
  MATCH_SCORE_PROJECTION_PORT,
  type MatchScoreProjectionPort,
} from '../../matches/application/ports/match-score-projection.port.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { createProfileDetailQuery } from '../details/profile-detail.query.js';

@Injectable()
export class ProfilesService {
  private readonly profileDetailQuery;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(MATCH_ACTIVE_VIEW_PORT)
    private readonly matchActiveView: MatchActiveViewPort,
    @Inject(MATCH_SCORE_PROJECTION_PORT)
    private readonly matchScoreProjection: MatchScoreProjectionPort,
    @Inject(BLOCK_VISIBILITY_READER_PORT)
    private readonly blockVisibilityReader: BlockVisibilityReaderPort,
  ) {
    this.profileDetailQuery = createProfileDetailQuery({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      matchActiveView: this.matchActiveView,
      matchScoreProjection: this.matchScoreProjection,
      blockVisibilityReader: this.blockVisibilityReader,
    });
  }

  async getProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    options: { detailEntryToken?: string } = {},
  ): Promise<PublicProfile> {
    return this.profileDetailQuery.getProfileByUserId(authUser, targetUserId, options);
  }
}

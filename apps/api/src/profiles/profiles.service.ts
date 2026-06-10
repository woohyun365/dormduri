import { Inject, Injectable } from '@nestjs/common';
import type { PublicProfile } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import {
  MATCH_ACTIVE_VIEW_PORT,
  type MatchActiveViewPort,
} from '../matches/application/ports/match-active-view.port.js';
import { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../seasons/ports/season-context.port.js';
import { createProfilesReadOwner } from './profiles-read-owner.js';

@Injectable()
export class ProfilesService {
  private readonly readOwner;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(MATCH_ACTIVE_VIEW_PORT)
    private readonly matchActiveView: MatchActiveViewPort,
  ) {
    this.readOwner = createProfilesReadOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      matchActiveView: this.matchActiveView,
    });
  }

  async getProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    options: { detailEntryToken?: string } = {},
  ): Promise<PublicProfile> {
    return this.readOwner.getProfileByUserId(authUser, targetUserId, options);
  }
}

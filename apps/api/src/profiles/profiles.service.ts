import { Injectable } from '@nestjs/common';
import type { PublicProfile } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { createProfilesReadOwner } from './profiles-read-owner.js';

@Injectable()
export class ProfilesService {
  private readonly readOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchesService: MatchesService,
  ) {
    this.readOwner = createProfilesReadOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      matchesService: this.matchesService,
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

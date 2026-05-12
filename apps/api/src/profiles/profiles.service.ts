import { Injectable } from '@nestjs/common';
import type { FullPublicProfile } from '@repo/shared/profile-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { CurrentUserViewService } from '../users/current-user-view.service.js';
import { createProfilesReadOwner } from './profiles-read-owner.js';
import { createProfilesMutationOwner } from './profiles-mutation-owner.js';

@Injectable()
export class ProfilesService {
  private readonly readOwner;
  private readonly mutationOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchesService: MatchesService,
    private readonly currentUserViewService: CurrentUserViewService,
  ) {
    this.readOwner = createProfilesReadOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      matchesService: this.matchesService,
    });
    this.mutationOwner = createProfilesMutationOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      moderationService: this.moderationService,
      seasonParticipantsService: this.seasonParticipantsService,
      currentUserViewService: this.currentUserViewService,
    });
  }

  async getProfileByUserId(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
  ): Promise<FullPublicProfile> {
    return this.readOwner.getProfileByUserId(authUser, targetUserId);
  }

  async updateLifestyle(
    authUser: AuthenticatedUserContext,
    lifestyle: Record<string, unknown>,
  ): Promise<CurrentUserResponse> {
    return this.mutationOwner.updateLifestyle(authUser, lifestyle);
  }

  async updateNickname(
    authUser: AuthenticatedUserContext,
    nickname: string,
  ): Promise<CurrentUserResponse> {
    return this.mutationOwner.updateNickname(authUser, nickname);
  }
}

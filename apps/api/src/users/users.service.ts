import { Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { CurrentUserViewService } from './current-user-view.service.js';
import { createUserUpdateOwner, type UpdateCurrentUserInput } from './user-update-owner.js';

@Injectable()
export class UsersService {
  private readonly updateOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly currentUserViewService: CurrentUserViewService,
  ) {
    this.updateOwner = createUserUpdateOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      moderationService: this.moderationService,
      seasonParticipantsService: this.seasonParticipantsService,
      currentUserViewService: this.currentUserViewService,
    });
  }

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    return this.currentUserViewService.getCurrentUser(authUser);
  }

  async updateCurrentUser(
    authUser: AuthenticatedUserContext,
    input: UpdateCurrentUserInput,
  ): Promise<CurrentUserResponse> {
    return this.updateOwner.updateCurrentUser(authUser, input);
  }
}

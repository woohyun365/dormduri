import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { UsersService } from './users.service.js';

@Controller('api/seasons/current/participation')
@UseGuards(AuthenticatedUserGuard)
export class CurrentSeasonParticipationController {
  constructor(
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    await this.seasonParticipantsService.registerCurrentSeasonParticipation(authUser.id);
    return this.usersService.getCurrentUser(authUser);
  }
}

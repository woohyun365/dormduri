import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { ProfilesService } from './profiles.service.js';

@Controller('api/profiles')
@UseGuards(AuthenticatedUserGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':userId')
  async getProfileByUserId(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('userId') userId: string,
  ) {
    return this.profilesService.getProfileByUserId(authUser, userId);
  }
}

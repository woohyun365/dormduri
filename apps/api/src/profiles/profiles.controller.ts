import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { profilesErrors } from './profiles.errors.js';
import { ProfilesService } from './profiles.service.js';

@Controller('api/profiles')
@UseGuards(AuthenticatedUserGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':userId')
  async getProfileByUserId(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('userId') userId: string,
    @Query('detailEntryToken') detailEntryToken: unknown,
  ) {
    const parsedDetailEntryToken = parseDetailEntryTokenQuery(detailEntryToken);
    return this.profilesService.getProfileByUserId(authUser, userId, {
      detailEntryToken: parsedDetailEntryToken,
    });
  }
}

function parseDetailEntryTokenQuery(input: unknown): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input !== 'string') {
    throw profilesErrors.invalidProfileQuery();
  }

  const token = input.trim();
  if (!token) {
    throw profilesErrors.invalidProfileQuery();
  }

  return token;
}

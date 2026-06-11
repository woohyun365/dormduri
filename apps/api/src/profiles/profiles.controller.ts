import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { profilesErrors } from './errors/profile.errors.js';
import { ProfilesService } from './application/profiles.service.js';

@Controller('api/profiles')
@RequireCapability()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':userId')
  async getProfileByUserId(
    @CurrentUser() authUser: AuthenticatedUserContext,
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

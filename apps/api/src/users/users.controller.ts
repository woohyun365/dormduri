import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  dismissCurrentUserOnboardingNoticeRequestSchema,
  requestAccountDeletionSchema,
  updateCurrentUserRequestSchema,
} from '@repo/shared/user-contract';
import { RequireCapability } from '../auth/auth-access.decorator.js';
import { AUTH_CAPABILITIES } from '../auth/auth-capability.js';
import { CurrentUser } from '../auth/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { UsersService } from './users.service.js';

@Controller('api/users')
@RequireCapability()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @RequireCapability(AUTH_CAPABILITIES.USER_READ_SELF)
  async getCurrentUser(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.usersService.getCurrentUser(authUser);
  }

  @Patch('me')
  @RequireCapability(AUTH_CAPABILITIES.USER_UPDATE_SELF)
  async updateCurrentUser(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(updateCurrentUserRequestSchema, body);
    return this.usersService.updateCurrentUser(authUser, parsed);
  }

  @Patch('me/onboarding')
  @RequireCapability(AUTH_CAPABILITIES.USER_UPDATE_SELF)
  async dismissCurrentUserOnboardingNotice(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(dismissCurrentUserOnboardingNoticeRequestSchema, body);
    return this.usersService.dismissCurrentUserOnboardingNotice(authUser, parsed);
  }

  @Post('me/delete')
  @RequireCapability(AUTH_CAPABILITIES.USER_UPDATE_SELF)
  async requestAccountDeletion(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(requestAccountDeletionSchema, body);
    return this.usersService.requestAccountDeletion(authUser, parsed);
  }
}

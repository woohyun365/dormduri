import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateCurrentUserRequestSchema } from '@repo/shared/user-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { UsersService } from './users.service.js';

@Controller('api/users')
@UseGuards(AuthenticatedUserGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.usersService.getCurrentUser(authUser);
  }

  @Patch('me')
  async updateCurrentUser(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(updateCurrentUserRequestSchema, body);
    return this.usersService.updateCurrentUser(authUser, parsed);
  }
}

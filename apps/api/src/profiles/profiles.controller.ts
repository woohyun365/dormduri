import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { lifestyleSchema } from '@repo/shared/lifestyle';
import { nicknamePatchRequestSchema } from '@repo/shared/profile-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
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

  @Patch('me/lifestyle')
  async updateLifestyle(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(
      lifestyleSchema,
      body,
      '생활패턴 요청 본문이 올바르지 않습니다.',
    );
    return this.profilesService.updateLifestyle(authUser, parsed);
  }

  @Patch('me/nickname')
  async updateNickname(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(nicknamePatchRequestSchema, body);
    return this.profilesService.updateNickname(authUser, parsed.nickname);
  }
}

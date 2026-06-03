import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { createMatchRequestSchema } from '@repo/shared/match-contract';
import { RequireCapability } from '../auth/auth-access.decorator.js';
import { CurrentUser } from '../auth/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { MatchesService } from './matches.service.js';

@Controller('api/matches')
@RequireCapability()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('requests')
  async getRequests(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.listCurrentSeasonRequests(authUser);
  }

  @Post('requests')
  async createRequest(@CurrentUser() authUser: AuthenticatedUserContext, @Body() body: unknown) {
    const parsed = parseRequestBody(createMatchRequestSchema, body);
    return this.matchesService.createMatchRequest(authUser, parsed);
  }

  @Post('requests/:id/accept')
  async acceptRequest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') requestId: string,
  ) {
    return this.matchesService.acceptMatchRequest(authUser, requestId);
  }

  @Post('requests/:id/reject')
  async rejectRequest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') requestId: string,
  ) {
    return this.matchesService.rejectMatchRequest(authUser, requestId);
  }

  @Post('requests/:id/cancel')
  async cancelRequest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') requestId: string,
  ) {
    return this.matchesService.cancelMatchRequest(authUser, requestId);
  }

  @Get('active')
  async getActiveMatch(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.getCurrentActiveMatch(authUser);
  }

  @Get('history')
  async getHistory(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.getMatchHistory(authUser);
  }

  @Get('history/entries/:entryId/counterpart-profile')
  async getHistoryCounterpartProfile(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('entryId') entryId: string,
  ) {
    return this.matchesService.getMatchHistoryCounterpartProfile(authUser, entryId);
  }

  @Post('active/:id/unmatch-request')
  async requestUnmatch(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') activeMatchId: string,
  ) {
    return this.matchesService.requestUnmatch(authUser, activeMatchId);
  }

  @Post('active/:id/unmatch-request/cancel')
  async cancelUnmatchRequest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') activeMatchId: string,
  ) {
    return this.matchesService.cancelUnmatchRequest(authUser, activeMatchId);
  }
}

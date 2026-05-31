import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createMatchRequestSchema } from '@repo/shared/match-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { MatchesService } from './matches.service.js';

@Controller('api/matches')
@UseGuards(AuthenticatedUserGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('requests')
  async getRequests(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.listCurrentSeasonRequests(authUser);
  }

  @Post('requests')
  async createRequest(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(createMatchRequestSchema, body);
    return this.matchesService.createMatchRequest(authUser, parsed);
  }

  @Post('requests/:id/accept')
  async acceptRequest(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('id') requestId: string,
  ) {
    return this.matchesService.acceptMatchRequest(authUser, requestId);
  }

  @Post('requests/:id/reject')
  async rejectRequest(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('id') requestId: string,
  ) {
    return this.matchesService.rejectMatchRequest(authUser, requestId);
  }

  @Post('requests/:id/cancel')
  async cancelRequest(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('id') requestId: string,
  ) {
    return this.matchesService.cancelMatchRequest(authUser, requestId);
  }

  @Get('active')
  async getActiveMatch(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.getCurrentActiveMatch(authUser);
  }

  @Get('history')
  async getHistory(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.getMatchHistory(authUser);
  }

  @Get('history/entries/:entryId/counterpart-profile')
  async getHistoryCounterpartProfile(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('entryId') entryId: string,
  ) {
    return this.matchesService.getMatchHistoryCounterpartProfile(authUser, entryId);
  }

  @Post('active/:id/unmatch-request')
  async requestUnmatch(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('id') activeMatchId: string,
  ) {
    return this.matchesService.requestUnmatch(authUser, activeMatchId);
  }

  @Post('active/:id/unmatch-request/cancel')
  async cancelUnmatchRequest(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('id') activeMatchId: string,
  ) {
    return this.matchesService.cancelUnmatchRequest(authUser, activeMatchId);
  }
}

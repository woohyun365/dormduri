import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  createMatchRequestSchema,
  type CreateMatchRequestRequest,
} from '@repo/shared/match/contract';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { forbiddenError } from '../platform/http/api-error.js';
import { parseRequestBody } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import {
  ActiveMatchContext,
  RequireActiveMatchParticipant,
} from './active/context/active-match-context.decorator.js';
import type { ActiveMatchContext as ActiveMatchContextValue } from './active/context/active-match-context.types.js';
import { MatchesService } from './application/matches.service.js';

@Controller('api/matches')
@RequireCapability()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('requests')
  async getRequests(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.listCurrentSeasonRequests(authUser);
  }

  @Get('overview')
  async getOverview(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.matchesService.getMatchOverview(authUser);
  }

  @Post('requests')
  async createRequest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body(new ZodRequestPipe((body: unknown) => parseRequestBody(createMatchRequestSchema, body)))
    parsed: CreateMatchRequestRequest,
  ) {
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
  @RequireActiveMatchParticipant()
  async requestUnmatch(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') activeMatchId: string,
    @ActiveMatchContext() activeMatch?: ActiveMatchContextValue,
  ) {
    return this.matchesService.requestUnmatch(
      authUser,
      resolveActiveMatchActorMatchId(authUser, activeMatchId, activeMatch),
    );
  }

  @Post('active/:id/unmatch-request/cancel')
  @RequireActiveMatchParticipant('unmatch-cancel-not-allowed')
  async cancelUnmatchRequest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('id') activeMatchId: string,
    @ActiveMatchContext() activeMatch?: ActiveMatchContextValue,
  ) {
    return this.matchesService.cancelUnmatchRequest(
      authUser,
      resolveActiveMatchActorMatchId(authUser, activeMatchId, activeMatch),
    );
  }
}

function resolveActiveMatchActorMatchId(
  authUser: AuthenticatedUserContext,
  activeMatchId: string,
  activeMatch: ActiveMatchContextValue | null | undefined,
) {
  if (!activeMatch) {
    return activeMatchId;
  }

  if (activeMatch.actorUserId !== authUser.id || activeMatch.activeMatchId !== activeMatchId) {
    throw forbiddenError(
      'ACTIVE_MATCH_CONTEXT_ACTOR_MISMATCH',
      '활성 매칭 컨텍스트와 로그인 사용자가 일치하지 않습니다.',
    );
  }

  return activeMatch.activeMatchId;
}

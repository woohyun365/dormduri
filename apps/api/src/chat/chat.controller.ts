import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { LeaveConversationThreadResponse } from '@repo/shared/chat-contract';
import {
  sendConversationMessageRequestSchema,
  updateChatReadMarkerRequestSchema,
} from '@repo/shared/chat-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { unauthorizedError } from '../common/http/api-error.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { ChatRealtimeMetricsService } from './realtime/chat-realtime.metrics.js';
import { ChatRealtimeTicketService } from './realtime/chat-realtime-ticket.service.js';
import {
  ChatRealtimeRateLimiterService,
  throwChatRealtimeRateLimitError,
} from './realtime/chat-realtime-rate-limiter.service.js';
import { ChatService } from './chat.service.js';

function parseReplayLimit(rawLimit: string | undefined): number {
  if (rawLimit === undefined) {
    return 100;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException({
      code: 'INVALID_QUERY',
      fieldErrors: {
        limit: ['limit must be an integer between 1 and 100'],
      },
    });
  }

  return limit;
}

function parseThreadListLimit(rawLimit: string | undefined): number | undefined {
  if (rawLimit === undefined) {
    return undefined;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BadRequestException({
      code: 'INVALID_QUERY',
      fieldErrors: {
        limit: ['limit must be an integer between 1 and 50'],
      },
    });
  }

  return limit;
}

@Controller('api/chat')
@UseGuards(AuthenticatedUserGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly realtimeTicketService: ChatRealtimeTicketService,
    private readonly rateLimiter: ChatRealtimeRateLimiterService,
    private readonly metrics: ChatRealtimeMetricsService,
  ) {}

  @Get('threads')
  async getThreads(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.listThreads(authUser, {
      limit: parseThreadListLimit(limit),
      cursor: cursor && cursor.trim().length > 0 ? cursor.trim() : null,
    });
  }

  @Get('threads/with/:targetUserId')
  async getThreadEntry(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.chatService.getThreadEntry(authUser, targetUserId);
  }

  @Get('threads/:threadId')
  async getThreadDetail(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
  ) {
    return this.chatService.getThreadDetail(authUser, threadId);
  }

  @Get('realtime/replay')
  async replayRealtimeEvents(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.replayRealtimeEvents(authUser, {
      after: after && after.trim().length > 0 ? after.trim() : null,
      limit: parseReplayLimit(limit),
    });
  }

  @Post('realtime/tickets')
  async issueRealtimeTicket(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Headers('authorization') authorization?: string,
    @Req() request?: Request,
  ) {
    const rateLimit = this.rateLimiter.consumeRealtimeTicket({
      userId: authUser.id,
      ip: this.rateLimiter.resolveRequestIp(request),
    });
    if (!rateLimit.allowed) {
      this.metrics.recordRateLimitRejection(rateLimit.scope);
      throwChatRealtimeRateLimitError(rateLimit);
    }

    const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const ticket = await this.realtimeTicketService.issueTicketFromAccessToken(accessToken);
    if (!ticket) {
      throw unauthorizedError('UNAUTHENTICATED', '로그인이 필요합니다.');
    }

    return ticket;
  }

  @Post('threads/:threadId/leave')
  async leaveThread(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
  ): Promise<LeaveConversationThreadResponse> {
    return this.chatService.leaveThread(authUser, threadId);
  }

  @Post('threads/:threadId/read-marker')
  async updateReadMarker(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(updateChatReadMarkerRequestSchema, body);
    return this.chatService.updateReadMarker(authUser, threadId, parsed);
  }

  @Post('messages')
  async sendMessage(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(sendConversationMessageRequestSchema, body);
    const rateLimit = this.rateLimiter.consumeMessageSend({
      userId: authUser.id,
      targetUserId: parsed.targetUserId,
    });
    if (!rateLimit.allowed) {
      this.metrics.recordRateLimitRejection(rateLimit.scope);
      throwChatRealtimeRateLimitError(rateLimit);
    }

    return this.chatService.sendMessage(authUser, parsed);
  }
}

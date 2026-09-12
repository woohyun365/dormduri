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
} from '@nestjs/common';
import type { Request } from 'express';
import {
  sendConversationMessageRequestSchema,
  updateChatReadMarkerRequestSchema,
  type UpdateChatReadMarkerRequest,
  type SendConversationMessageRequest,
  type LeaveConversationThreadResponse,
} from '@repo/shared/chat';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { forbiddenError, unauthorizedError } from '../platform/http/api-error.js';
import { parseRequestBody } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { ChatThread, RequireChatThreadMember } from './context/chat-thread-context.decorator.js';
import type { ChatThreadContext } from './context/chat-thread-context.types.js';
import { ChatRealtimeMetricsService } from './realtime/chat-realtime.metrics.js';
import { ChatRealtimeTicketService } from './realtime/chat-realtime-ticket.service.js';
import {
  ChatRealtimeRateLimiterService,
  throwChatRealtimeRateLimitError,
} from './realtime/chat-realtime-rate-limiter.service.js';
import { ChatService } from './application/chat.service.js';

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
@RequireCapability()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly realtimeTicketService: ChatRealtimeTicketService,
    private readonly rateLimiter: ChatRealtimeRateLimiterService,
    private readonly metrics: ChatRealtimeMetricsService,
  ) {}

  @Get('threads')
  async getThreads(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.listThreads(authUser, {
      limit: parseThreadListLimit(limit),
      cursor: cursor && cursor.trim().length > 0 ? cursor.trim() : null,
    });
  }

  @Get('conversation-stats')
  async getConversationStats(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.chatService.getConversationStats(authUser);
  }

  @Get('threads/with/:targetUserId')
  async getThreadEntry(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.chatService.getThreadEntry(authUser, targetUserId);
  }

  @Get('threads/:threadId')
  @RequireChatThreadMember()
  async getThreadDetail(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
    @ChatThread() chatThread?: ChatThreadContext,
  ) {
    return this.chatService.getThreadDetail(
      authUser,
      resolveChatThreadActorThreadId(authUser, threadId, chatThread),
    );
  }

  @Get('realtime/replay')
  async replayRealtimeEvents(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    const response = await this.chatService.replayRealtimeEvents(authUser, {
      after: after && after.trim().length > 0 ? after.trim() : null,
      limit: parseReplayLimit(limit),
    });
    if (!response.ok) {
      this.metrics.recordReplayResyncRequired(response.reason);
    }

    return response;
  }

  @Post('realtime/tickets')
  async issueRealtimeTicket(
    @CurrentUser() authUser: AuthenticatedUserContext,
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
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
  ): Promise<LeaveConversationThreadResponse> {
    return this.chatService.leaveThread(authUser, threadId);
  }

  @Post('threads/:threadId/read-marker')
  @RequireChatThreadMember()
  async updateReadMarker(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
    @Body(
      new ZodRequestPipe((body: unknown) =>
        parseRequestBody(updateChatReadMarkerRequestSchema, body),
      ),
    )
    parsed: UpdateChatReadMarkerRequest,
    @ChatThread() chatThread?: ChatThreadContext,
  ) {
    return this.chatService.updateReadMarker(
      authUser,
      resolveChatThreadActorThreadId(authUser, threadId, chatThread),
      parsed,
    );
  }

  @Post('messages')
  async sendMessage(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body(
      new ZodRequestPipe((body: unknown) =>
        parseRequestBody(sendConversationMessageRequestSchema, body),
      ),
    )
    parsed: SendConversationMessageRequest,
  ) {
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

function resolveChatThreadActorThreadId(
  authUser: AuthenticatedUserContext,
  threadId: string,
  chatThread: ChatThreadContext | null | undefined,
) {
  if (!chatThread) {
    return threadId;
  }

  if (chatThread.actorUserId !== authUser.id || chatThread.threadId !== threadId) {
    throw forbiddenError(
      'CHAT_THREAD_CONTEXT_ACTOR_MISMATCH',
      '채팅 thread 컨텍스트와 로그인 사용자가 일치하지 않습니다.',
    );
  }

  return chatThread.threadId;
}

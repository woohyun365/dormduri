import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { LeaveConversationThreadResponse } from '@repo/shared/chat-contract';
import {
  sendConversationMessageRequestSchema,
  updateChatReadMarkerRequestSchema,
} from '@repo/shared/chat-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
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

@Controller('api/chat')
@UseGuards(AuthenticatedUserGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('threads')
  async getThreads(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.chatService.listThreads(authUser);
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
    return this.chatService.sendMessage(authUser, parsed);
  }
}

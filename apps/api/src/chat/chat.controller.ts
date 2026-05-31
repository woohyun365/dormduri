import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { LeaveConversationThreadResponse } from '@repo/shared/chat-contract';
import { sendConversationMessageRequestSchema } from '@repo/shared/chat-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { ChatService } from './chat.service.js';

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

  @Post('threads/:threadId/leave')
  async leaveThread(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Param('threadId') threadId: string,
  ): Promise<LeaveConversationThreadResponse> {
    return this.chatService.leaveThread(authUser, threadId);
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

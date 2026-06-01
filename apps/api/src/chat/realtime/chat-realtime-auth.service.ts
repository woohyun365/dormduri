import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserContext } from '../../auth/auth-session.service.js';
import { ChatService } from '../chat.service.js';
import { ChatRealtimeTicketService } from './chat-realtime-ticket.service.js';

@Injectable()
export class ChatRealtimeAuthService {
  constructor(
    private readonly ticketService: ChatRealtimeTicketService,
    private readonly chatService: ChatService,
  ) {}

  consumeTicket(ticket: string | null | undefined) {
    return this.ticketService.consumeTicket(ticket);
  }

  async canSubscribeThread(authUser: AuthenticatedUserContext, threadId: string): Promise<boolean> {
    try {
      return await this.chatService.canSubscribeThread(authUser, threadId);
    } catch {
      return false;
    }
  }
}

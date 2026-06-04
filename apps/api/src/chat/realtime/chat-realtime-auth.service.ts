import { Injectable } from '@nestjs/common';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { ChatSubscriptionQueryService } from '../queries/chat-subscription-query.service.js';
import { ChatRealtimeTicketService } from './chat-realtime-ticket.service.js';

@Injectable()
export class ChatRealtimeAuthService {
  constructor(
    private readonly ticketService: ChatRealtimeTicketService,
    private readonly subscriptionQueryService: ChatSubscriptionQueryService,
  ) {}

  consumeTicket(ticket: string | null | undefined) {
    return this.ticketService.consumeTicket(ticket);
  }

  async canSubscribeThread(authUser: AuthenticatedUserContext, threadId: string): Promise<boolean> {
    try {
      return await this.subscriptionQueryService.canSubscribeThreadForViewer(authUser.id, threadId);
    } catch {
      return false;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import {
  CHAT_REALTIME_TICKET_SCOPE,
  CHAT_REALTIME_TICKET_TTL_SECONDS,
} from './chat-realtime.constants.js';

type TicketStoreRecord = {
  accessToken: string;
  expiresAt: Date;
};

export type ChatRealtimeTicketIssueResult = {
  ticket: string;
  scope: typeof CHAT_REALTIME_TICKET_SCOPE;
  expiresAt: string;
};

@Injectable()
export class ChatRealtimeTicketService {
  private readonly tickets = new Map<string, TicketStoreRecord>();

  constructor(private readonly authActorContextResolver: AuthActorContextResolver) {}

  async issueTicketFromAccessToken(
    accessToken: string | null,
  ): Promise<ChatRealtimeTicketIssueResult | null> {
    if (!accessToken) {
      return null;
    }

    const authUser = await this.authActorContextResolver.resolveCurrentUserContext(accessToken);
    if (!authUser) {
      return null;
    }

    const now = this.now();
    this.deleteExpiredTickets(now);
    const ticket = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + CHAT_REALTIME_TICKET_TTL_SECONDS * 1000);
    this.tickets.set(ticket, { accessToken, expiresAt });

    return {
      ticket,
      scope: CHAT_REALTIME_TICKET_SCOPE,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async consumeTicket(ticket: string | null | undefined): Promise<AuthenticatedUserContext | null> {
    if (!ticket) {
      return null;
    }

    const record = this.tickets.get(ticket);
    this.tickets.delete(ticket);

    if (!record || record.expiresAt.getTime() <= this.now().getTime()) {
      return null;
    }

    return this.authActorContextResolver.resolveCurrentUserContext(record.accessToken);
  }

  private deleteExpiredTickets(now: Date) {
    for (const [ticket, record] of this.tickets) {
      if (record.expiresAt.getTime() <= now.getTime()) {
        this.tickets.delete(ticket);
      }
    }
  }

  private now() {
    return new Date();
  }
}

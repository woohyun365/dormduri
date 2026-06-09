import { Injectable } from '@nestjs/common';
import type {
  AppendSupportTicketMessageRequest,
  CreateSupportTicketRequest,
  ListSupportFaqQuery,
  ListSupportTicketsQuery,
  ReplySupportTicketRequest,
  ResolveSupportTicketRequest,
} from '@repo/shared/support';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { AppendSupportTicketMessageCommand } from '../commands/append-support-ticket-message.command.js';
import { CreateSupportTicketCommand } from '../commands/create-support-ticket.command.js';
import { ReplySupportTicketCommand } from '../commands/reply-support-ticket.command.js';
import { ResolveSupportTicketCommand } from '../commands/resolve-support-ticket.command.js';
import { SupportFaqQuery } from '../queries/support-faq.query.js';
import { SupportTicketDetailQuery } from '../queries/support-ticket-detail.query.js';
import { SupportTicketListQuery } from '../queries/support-ticket-list.query.js';

@Injectable()
export class SupportService {
  constructor(
    private readonly createTicketCommand: CreateSupportTicketCommand,
    private readonly appendMessageCommand: AppendSupportTicketMessageCommand,
    private readonly replyTicketCommand: ReplySupportTicketCommand,
    private readonly resolveTicketCommand: ResolveSupportTicketCommand,
    private readonly ticketListQuery: SupportTicketListQuery,
    private readonly ticketDetailQuery: SupportTicketDetailQuery,
    private readonly faqQuery: SupportFaqQuery,
  ) {}

  createTicket(authUser: AuthenticatedUserContext, request: CreateSupportTicketRequest) {
    return this.createTicketCommand.execute({ authUser, request });
  }

  listOwnTickets(authUser: AuthenticatedUserContext, query: ListSupportTicketsQuery) {
    return this.ticketListQuery.listOwn(authUser, query);
  }

  getOwnTicket(authUser: AuthenticatedUserContext, ticketId: string) {
    return this.ticketDetailQuery.getOwn(authUser, ticketId);
  }

  appendOwnMessage(
    authUser: AuthenticatedUserContext,
    ticketId: string,
    request: AppendSupportTicketMessageRequest,
  ) {
    return this.appendMessageCommand.execute({ authUser, ticketId, request });
  }

  listOperationTickets(query: ListSupportTicketsQuery) {
    return this.ticketListQuery.listOperations(query);
  }

  getOperationTicket(ticketId: string) {
    return this.ticketDetailQuery.getOperations(ticketId);
  }

  replyAsOperator(
    authUser: AuthenticatedUserContext,
    ticketId: string,
    request: ReplySupportTicketRequest,
  ) {
    return this.replyTicketCommand.execute({ authUser, ticketId, request });
  }

  resolveAsOperator(
    authUser: AuthenticatedUserContext,
    ticketId: string,
    request: ResolveSupportTicketRequest,
  ) {
    return this.resolveTicketCommand.execute({ authUser, ticketId, request });
  }

  listFaq(query: ListSupportFaqQuery) {
    return this.faqQuery.list(query);
  }

  getFaq(articleId: string) {
    return this.faqQuery.get(articleId);
  }
}

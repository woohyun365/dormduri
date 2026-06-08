import { Injectable } from '@nestjs/common';
import type {
  ListSupportTicketsQuery,
  SupportTicketListResponse,
} from '@repo/shared/support-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { toSupportTicketListResponse } from '../presenters/support-ticket.presenter.js';
import { decodeSupportTicketCursor } from './support-ticket-list.cursor.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

@Injectable()
export class SupportTicketListQuery {
  constructor(private readonly repository: SupportTicketRepository) {}

  async listOwn(
    authUser: AuthenticatedUserContext,
    query: ListSupportTicketsQuery,
  ): Promise<SupportTicketListResponse> {
    const records = await this.repository.listForRequester({
      requesterUserId: authUser.id,
      status: query.status,
      category: query.category,
      cursor: decodeSupportTicketCursor(query.cursor),
      limit: query.limit,
    });
    return toSupportTicketListResponse({ records, limit: query.limit });
  }

  async listOperations(query: ListSupportTicketsQuery): Promise<SupportTicketListResponse> {
    const records = await this.repository.listForOperations({
      status: query.status,
      category: query.category,
      cursor: decodeSupportTicketCursor(query.cursor),
      limit: query.limit,
    });
    return toSupportTicketListResponse({ records, limit: query.limit });
  }
}

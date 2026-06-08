import { Injectable } from '@nestjs/common';
import type { SupportTicketDetailResponse } from '@repo/shared/support-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { supportErrors } from '../errors/support.errors.js';
import { toSupportTicketDetailResponse } from '../presenters/support-ticket.presenter.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

@Injectable()
export class SupportTicketDetailQuery {
  constructor(private readonly repository: SupportTicketRepository) {}

  async getOwn(
    authUser: AuthenticatedUserContext,
    ticketId: string,
  ): Promise<SupportTicketDetailResponse> {
    const ticket = await this.repository.findOwnedById({
      id: ticketId,
      requesterUserId: authUser.id,
    });
    if (!ticket) {
      throw supportErrors.ticketNotFound();
    }
    const messages = await this.repository.listMessages({ ticketId: ticket.id });
    return toSupportTicketDetailResponse({ ticket, messages });
  }

  async getOperations(ticketId: string): Promise<SupportTicketDetailResponse> {
    const ticket = await this.repository.findById({ id: ticketId });
    if (!ticket) {
      throw supportErrors.ticketNotFound();
    }
    const messages = await this.repository.listMessages({ ticketId: ticket.id });
    return toSupportTicketDetailResponse({ ticket, messages });
  }
}

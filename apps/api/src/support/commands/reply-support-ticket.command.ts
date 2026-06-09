import { Injectable } from '@nestjs/common';
import type { ReplySupportTicketRequest, ReplySupportTicketResponse } from '@repo/shared/support';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { supportErrors } from '../errors/support.errors.js';
import { SupportNotificationService } from '../notifications/support-notification.service.js';
import { assertOperatorCanReplySupportTicket } from '../policies/support-ticket-status.policy.js';
import {
  toSupportTicketMessageResponse,
  toSupportTicketResponse,
} from '../presenters/support-ticket.presenter.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

@Injectable()
export class ReplySupportTicketCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SupportTicketRepository,
    private readonly notificationService: SupportNotificationService,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    ticketId: string;
    request: ReplySupportTicketRequest;
  }): Promise<ReplySupportTicketResponse> {
    const now = await this.prisma.getDatabaseNow();
    const result = await this.prisma.runSerializableTransaction(async (tx) => {
      const existing = await this.repository.findById({ id: input.ticketId, client: tx });
      if (!existing) {
        throw supportErrors.ticketNotFound();
      }
      assertOperatorCanReplySupportTicket(existing.status);

      const message = await this.repository.createMessage({
        client: tx,
        ticketId: existing.id,
        senderType: 'OPERATOR',
        senderUserId: input.authUser.id,
        body: input.request.body,
        now,
      });
      const ticket = await this.repository.updateTicketStatus({
        client: tx,
        ticketId: existing.id,
        status: input.request.status,
        lastMessageAt: now,
        closedAt: input.request.status === 'WAITING_USER' ? null : now,
        now,
      });

      await this.notificationService.appendTicketReplied({
        tx,
        requesterUserId: existing.requesterUserId,
        operatorUserId: input.authUser.id,
        supportTicketId: existing.id,
        status: input.request.status,
        occurredAt: now,
      });

      return { ticket, message };
    });

    return {
      ticket: toSupportTicketResponse(result.ticket),
      message: toSupportTicketMessageResponse(result.message),
    };
  }
}

import { Injectable } from '@nestjs/common';
import type {
  AppendSupportTicketMessageRequest,
  AppendSupportTicketMessageResponse,
} from '@repo/shared/support-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { supportErrors } from '../errors/support.errors.js';
import { assertUserCanAppendSupportMessage } from '../policies/support-ticket-status.policy.js';
import {
  toSupportTicketMessageResponse,
  toSupportTicketResponse,
} from '../presenters/support-ticket.presenter.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

@Injectable()
export class AppendSupportTicketMessageCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SupportTicketRepository,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    ticketId: string;
    request: AppendSupportTicketMessageRequest;
  }): Promise<AppendSupportTicketMessageResponse> {
    const now = await this.prisma.getDatabaseNow();

    const result = await this.prisma.runSerializableTransaction(async (tx) => {
      const existing = await this.repository.findOwnedById({
        id: input.ticketId,
        requesterUserId: input.authUser.id,
        client: tx,
      });
      if (!existing) {
        throw supportErrors.ticketNotFound();
      }

      const nextStatus = assertUserCanAppendSupportMessage(existing.status);
      const message = await this.repository.createMessage({
        client: tx,
        ticketId: existing.id,
        senderType: 'USER',
        senderUserId: input.authUser.id,
        body: input.request.body,
        now,
      });
      const ticket = await this.repository.updateTicketStatus({
        client: tx,
        ticketId: existing.id,
        status: nextStatus,
        lastMessageAt: now,
        closedAt: null,
        now,
      });

      return { ticket, message };
    });

    return {
      ticket: toSupportTicketResponse(result.ticket),
      message: toSupportTicketMessageResponse(result.message),
    };
  }
}

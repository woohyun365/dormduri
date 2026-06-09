import { Injectable } from '@nestjs/common';
import type {
  ResolveSupportTicketRequest,
  ResolveSupportTicketResponse,
} from '@repo/shared/support';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { supportErrors } from '../errors/support.errors.js';
import { SupportNotificationService } from '../notifications/support-notification.service.js';
import { toSupportTicketResponse } from '../presenters/support-ticket.presenter.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

@Injectable()
export class ResolveSupportTicketCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SupportTicketRepository,
    private readonly notificationService: SupportNotificationService,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    ticketId: string;
    request: ResolveSupportTicketRequest;
  }): Promise<ResolveSupportTicketResponse> {
    const now = await this.prisma.getDatabaseNow();
    const ticket = await this.prisma.runSerializableTransaction(async (tx) => {
      const existing = await this.repository.findById({ id: input.ticketId, client: tx });
      if (!existing) {
        throw supportErrors.ticketNotFound();
      }

      const updated = await this.repository.updateTicketStatus({
        client: tx,
        ticketId: existing.id,
        status: input.request.status,
        closedAt: now,
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

      return updated;
    });

    return { ticket: toSupportTicketResponse(ticket) };
  }
}

import { Injectable } from '@nestjs/common';
import type {
  CreateSupportTicketRequest,
  CreateSupportTicketResponse,
} from '@repo/shared/support-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { SupportNotificationService } from '../notifications/support-notification.service.js';
import { toSupportTicketResponse } from '../presenters/support-ticket.presenter.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

@Injectable()
export class CreateSupportTicketCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SupportTicketRepository,
    private readonly notificationService: SupportNotificationService,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    request: CreateSupportTicketRequest;
  }): Promise<CreateSupportTicketResponse> {
    const now = await this.prisma.getDatabaseNow();
    const ticket = await this.prisma.runSerializableTransaction(async (tx) => {
      const { ticket } = await this.repository.createTicketWithMessage({
        client: tx,
        requesterUserId: input.authUser.id,
        category: input.request.category,
        subject: input.request.subject,
        body: input.request.body,
        relatedEntityId: input.request.relatedEntityId,
        appealCategory: input.request.appealCategory,
        emailReplyConsent: input.request.emailReplyConsent,
        now,
      });

      await this.notificationService.appendTicketCreated({
        tx,
        requesterUserId: input.authUser.id,
        supportTicketId: ticket.id,
        category: ticket.category,
        occurredAt: now,
      });

      return ticket;
    });

    return { ticket: toSupportTicketResponse(ticket) };
  }
}

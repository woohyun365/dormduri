import { Inject, Injectable } from '@nestjs/common';
import type { SupportTicketStatus } from '@repo/shared/support';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  NOTIFICATION_WRITER,
  type NotificationWriterPort,
} from '../../notifications/application/ports/notification-writer.port.js';
import { assertSupportNotificationPayloadSafe } from '../policies/support-payload.policy.js';

@Injectable()
export class SupportNotificationService {
  constructor(
    @Inject(NOTIFICATION_WRITER)
    private readonly notificationWriter: NotificationWriterPort,
  ) {}

  async appendTicketCreated(input: {
    tx: Prisma.TransactionClient;
    requesterUserId: string;
    supportTicketId: string;
    category: string;
    occurredAt: Date;
  }) {
    const payload = {
      kind: 'SUPPORT_TICKET_CREATED' as const,
      supportTicketId: input.supportTicketId,
      category: input.category,
      status: 'OPEN' as const,
      occurredAt: input.occurredAt.toISOString(),
    };
    assertSupportNotificationPayloadSafe(payload);

    return this.notificationWriter.appendNotification(input.tx, {
      recipientUserId: input.requesterUserId,
      actorUserId: input.requesterUserId,
      kind: 'SUPPORT_TICKET_CREATED',
      sourceType: 'SUPPORT_TICKET',
      sourceId: input.supportTicketId,
      payload,
      occurredAt: input.occurredAt,
    });
  }

  async appendTicketReplied(input: {
    tx: Prisma.TransactionClient;
    requesterUserId: string;
    operatorUserId: string;
    supportTicketId: string;
    status: Extract<SupportTicketStatus, 'WAITING_USER' | 'RESOLVED' | 'CLOSED'>;
    occurredAt: Date;
  }) {
    const payload = {
      kind: 'SUPPORT_TICKET_REPLIED' as const,
      supportTicketId: input.supportTicketId,
      status: input.status,
      occurredAt: input.occurredAt.toISOString(),
    };
    assertSupportNotificationPayloadSafe(payload);

    return this.notificationWriter.appendNotification(input.tx, {
      recipientUserId: input.requesterUserId,
      actorUserId: input.operatorUserId,
      kind: 'SUPPORT_TICKET_REPLIED',
      sourceType: 'SUPPORT_TICKET',
      sourceId: input.supportTicketId,
      payload,
      occurredAt: input.occurredAt,
    });
  }
}

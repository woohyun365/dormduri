import { Inject, Injectable } from '@nestjs/common';
import type { NotificationPayload } from '@repo/shared/notification-contract';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  NOTIFICATION_WRITER,
  type NotificationWriterPort,
} from '../../../notifications/application/ports/notification-writer.port.js';

@Injectable()
export class ReportNotificationService {
  constructor(
    @Inject(NOTIFICATION_WRITER)
    private readonly notificationWriter: NotificationWriterPort,
  ) {}

  appendReporterReceipt(
    tx: Prisma.TransactionClient,
    input: {
      reportCaseId: string;
      reporterUserId: string;
      occurredAt: Date;
    },
  ) {
    const payload = {
      kind: 'REPORT_RECEIVED',
      reportId: input.reportCaseId,
      status: 'RECEIVED',
      occurredAt: input.occurredAt.toISOString(),
    } satisfies Extract<NotificationPayload, { kind: 'REPORT_RECEIVED' }>;

    return this.notificationWriter.appendNotification(tx, {
      recipientUserId: input.reporterUserId,
      actorUserId: input.reporterUserId,
      kind: 'REPORT_RECEIVED',
      sourceType: 'REPORT_CASE',
      sourceId: input.reportCaseId,
      payload,
      occurredAt: input.occurredAt,
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  NOTIFICATION_WRITER,
  type NotificationWriterPort,
} from '../../../notifications/application/ports/notification-writer.port.js';
import { toReportReceivedNotificationPayload } from '../../../notifications/policies/notification-payload.policy.js';

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
    return this.notificationWriter.appendNotification(tx, {
      recipientUserId: input.reporterUserId,
      actorUserId: input.reporterUserId,
      kind: 'REPORT_RECEIVED',
      sourceType: 'REPORT_CASE',
      sourceId: input.reportCaseId,
      payload: toReportReceivedNotificationPayload({
        reportId: input.reportCaseId,
        occurredAt: input.occurredAt,
      }),
      occurredAt: input.occurredAt,
    });
  }
}

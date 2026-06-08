import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type AppendNotificationInput,
  type AppendNotificationResult,
  type NotificationWriterPort,
} from '../application/ports/notification-writer.port.js';
import { toUserNotification } from '../mappers/notification-presenter.js';
import { assertNotificationPayloadAllowed } from '../policies/notification-payload.policy.js';

const NOTIFICATION_CREATED_EVENT_TYPE = 'notification.created';

type NotificationTx = Prisma.TransactionClient;

@Injectable()
export class CreateNotificationCommand implements NotificationWriterPort {
  async appendNotification(
    tx: NotificationTx,
    input: AppendNotificationInput,
  ): Promise<AppendNotificationResult> {
    assertNotificationPayloadAllowed(input.payload);

    const existing = await tx.userNotification.findUnique({
      where: {
        recipientUserId_kind_sourceType_sourceId: {
          recipientUserId: input.recipientUserId,
          kind: input.kind,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { notificationId: existing.id, created: false };
    }

    const notification = await tx.userNotification.create({
      data: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId,
        kind: input.kind,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        payload: input.payload,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
      select: {
        id: true,
        recipientUserId: true,
        actorUserId: true,
        kind: true,
        sourceType: true,
        sourceId: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
    });

    await tx.notificationOutboxEvent.create({
      data: {
        notificationId: notification.id,
        recipientUserId: input.recipientUserId,
        eventType: NOTIFICATION_CREATED_EVENT_TYPE,
        schemaVersion: 1,
        payload: {
          notification: toUserNotification(notification),
        },
        status: 'PENDING',
        availableAt: input.occurredAt,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
    });

    return { notificationId: notification.id, created: true };
  }
}

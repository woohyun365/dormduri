import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ChatThreadNotificationWriter } from '../notifications.tokens.js';
import { toChatThreadCreatedNotificationPayload } from '../policies/notification-payload.policy.js';
import { toUserNotification } from '../mappers/notification-presenter.js';

const CHAT_THREAD_CREATED_KIND = 'CHAT_THREAD_CREATED' as const;
const CONVERSATION_THREAD_SOURCE = 'CONVERSATION_THREAD';
const NOTIFICATION_CREATED_EVENT_TYPE = 'notification.created';

type NotificationTx = Prisma.TransactionClient;

@Injectable()
export class CreateChatThreadNotificationCommand implements ChatThreadNotificationWriter {
  async appendChatThreadCreated(
    tx: NotificationTx,
    input: {
      threadId: string;
      actorUserId: string;
      recipientUserId: string;
      occurredAt: Date;
    },
  ): Promise<{ notificationId: string; created: boolean }> {
    if (input.actorUserId === input.recipientUserId) {
      return { notificationId: '', created: false };
    }

    const existing = await tx.userNotification.findUnique({
      where: {
        recipientUserId_kind_sourceType_sourceId: {
          recipientUserId: input.recipientUserId,
          kind: CHAT_THREAD_CREATED_KIND,
          sourceType: CONVERSATION_THREAD_SOURCE,
          sourceId: input.threadId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { notificationId: existing.id, created: false };
    }

    const payload = toChatThreadCreatedNotificationPayload(input);
    const notification = await tx.userNotification.create({
      data: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId,
        kind: CHAT_THREAD_CREATED_KIND,
        sourceType: CONVERSATION_THREAD_SOURCE,
        sourceId: input.threadId,
        payload,
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

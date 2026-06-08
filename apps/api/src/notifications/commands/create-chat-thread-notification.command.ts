import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { type ChatThreadNotificationWriter } from '../application/ports/chat-thread-notification-writer.port.js';
import {
  NOTIFICATION_WRITER,
  type NotificationWriterPort,
} from '../application/ports/notification-writer.port.js';
import { toChatThreadCreatedNotificationPayload } from '../policies/notification-payload.policy.js';

const CHAT_THREAD_CREATED_KIND = 'CHAT_THREAD_CREATED' as const;
const CONVERSATION_THREAD_SOURCE = 'CONVERSATION_THREAD' as const;

type NotificationTx = Prisma.TransactionClient;

@Injectable()
export class CreateChatThreadNotificationCommand implements ChatThreadNotificationWriter {
  constructor(
    @Inject(NOTIFICATION_WRITER)
    private readonly notificationWriter: NotificationWriterPort,
  ) {}

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

    return this.notificationWriter.appendNotification(tx, {
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      kind: CHAT_THREAD_CREATED_KIND,
      sourceType: CONVERSATION_THREAD_SOURCE,
      sourceId: input.threadId,
      payload: toChatThreadCreatedNotificationPayload(input),
      occurredAt: input.occurredAt,
    });
  }
}

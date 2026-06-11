import type { Prisma } from '../../../generated/prisma/client.js';
import type { AppendNotificationResult } from './notification-writer.port.js';

export const CHAT_THREAD_NOTIFICATION_WRITER = Symbol('CHAT_THREAD_NOTIFICATION_WRITER');

export type ChatThreadNotificationWriter = {
  appendChatThreadCreated(
    tx: Prisma.TransactionClient,
    input: {
      threadId: string;
      actorUserId: string;
      recipientUserId: string;
      occurredAt: Date;
    },
  ): Promise<AppendNotificationResult>;
};

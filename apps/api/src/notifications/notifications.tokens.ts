import type { Prisma } from '../generated/prisma/client.js';

export const CHAT_THREAD_NOTIFICATION_WRITER = Symbol('CHAT_THREAD_NOTIFICATION_WRITER');
export const NOTIFICATION_REALTIME_PUBLISHER = Symbol('NOTIFICATION_REALTIME_PUBLISHER');

export type ChatThreadNotificationWriter = {
  appendChatThreadCreated(
    tx: Prisma.TransactionClient,
    input: {
      threadId: string;
      actorUserId: string;
      recipientUserId: string;
      occurredAt: Date;
    },
  ): Promise<{ notificationId: string; created: boolean }>;
};

export type NotificationRealtimePublisherPort = {
  isBound(): boolean;
  publishNotificationCreated(input: { recipientUserId: string; event: unknown }): void;
};

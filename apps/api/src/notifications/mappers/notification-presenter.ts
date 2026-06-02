import type { UserNotification } from '@repo/shared/notification-contract';
import { notificationPayloadSchema } from '@repo/shared/notification-contract';

export type UserNotificationRecord = {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  kind: 'CHAT_THREAD_CREATED';
  sourceType: string;
  sourceId: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
};

export function toUserNotification(record: UserNotificationRecord): UserNotification {
  const payload = notificationPayloadSchema.parse(record.payload);
  if (record.sourceType !== 'CONVERSATION_THREAD') {
    throw new Error(`[notification-presenter] unsupported sourceType: ${record.sourceType}`);
  }

  return {
    id: record.id,
    recipientUserId: record.recipientUserId,
    actorUserId: record.actorUserId,
    kind: record.kind,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    payload,
    readAt: record.readAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

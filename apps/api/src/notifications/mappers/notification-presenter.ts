import type { UserNotification } from '@repo/shared/notification-contract';
import {
  notificationKindSchema,
  notificationPayloadSchema,
  notificationSourceTypeSchema,
} from '@repo/shared/notification-contract';

export type UserNotificationRecord = {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  kind: unknown;
  sourceType: unknown;
  sourceId: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
};

export function toUserNotification(record: UserNotificationRecord): UserNotification {
  const kind = notificationKindSchema.parse(record.kind);
  const sourceType = notificationSourceTypeSchema.parse(record.sourceType);
  const payload = notificationPayloadSchema.parse(record.payload);

  return {
    id: record.id,
    recipientUserId: record.recipientUserId,
    actorUserId: record.actorUserId,
    kind,
    sourceType,
    sourceId: record.sourceId,
    payload,
    readAt: record.readAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

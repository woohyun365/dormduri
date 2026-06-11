import type {
  NotificationKind,
  NotificationPayload,
  NotificationSourceType,
} from '@repo/shared/notifications';
import type { Prisma } from '../../../generated/prisma/client.js';

export const NOTIFICATION_WRITER = Symbol('NOTIFICATION_WRITER');

export interface AppendNotificationInput {
  recipientUserId: string;
  actorUserId: string;
  kind: NotificationKind;
  sourceType: NotificationSourceType;
  sourceId: string;
  payload: NotificationPayload;
  occurredAt: Date;
}

export interface AppendNotificationResult {
  notificationId: string;
  created: boolean;
}

export interface NotificationWriterPort {
  appendNotification(
    tx: Prisma.TransactionClient,
    input: AppendNotificationInput,
  ): Promise<AppendNotificationResult>;
}

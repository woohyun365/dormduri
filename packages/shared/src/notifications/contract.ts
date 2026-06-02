import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date-primitives.js';

export const notificationKindSchema = z.enum(['CHAT_THREAD_CREATED']);
export const notificationSourceTypeSchema = z.enum(['CONVERSATION_THREAD']);

export const chatThreadCreatedNotificationPayloadSchema = z.strictObject({
  threadId: z.string().min(1),
  actorUserId: z.string().min(1),
  recipientUserId: z.string().min(1),
  occurredAt: isoDateTimeStringSchema,
});

export const notificationPayloadSchema = z.discriminatedUnion('kind', [
  chatThreadCreatedNotificationPayloadSchema.extend({
    kind: z.literal('CHAT_THREAD_CREATED'),
  }),
]);

export const userNotificationSchema = z.strictObject({
  id: z.string().min(1),
  recipientUserId: z.string().min(1),
  actorUserId: z.string().min(1),
  kind: notificationKindSchema,
  sourceType: notificationSourceTypeSchema,
  sourceId: z.string().min(1),
  payload: notificationPayloadSchema,
  readAt: isoDateTimeStringSchema.nullable(),
  createdAt: isoDateTimeStringSchema,
});

export const listNotificationsQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional().nullable(),
});

export const notificationListResponseSchema = z.strictObject({
  items: z.array(userNotificationSchema),
  pageInfo: z.strictObject({
    hasNextPage: z.boolean(),
    nextCursor: z.string().min(1).nullable(),
  }),
});

export const notificationUnreadCountResponseSchema = z.strictObject({
  unreadCount: z.number().int().min(0),
});

export const markNotificationReadResponseSchema = z.strictObject({
  notification: userNotificationSchema,
});

export const notificationCreatedRealtimeEventSchema = z.strictObject({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  eventType: z.literal('notification.created'),
  occurredAt: isoDateTimeStringSchema,
  cursor: z.string().min(1),
  payload: z.strictObject({
    notification: userNotificationSchema,
  }),
});

export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type NotificationSourceType = z.infer<typeof notificationSourceTypeSchema>;
export type ChatThreadCreatedNotificationPayload = z.infer<
  typeof chatThreadCreatedNotificationPayloadSchema
>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type UserNotification = z.infer<typeof userNotificationSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type NotificationUnreadCountResponse = z.infer<typeof notificationUnreadCountResponseSchema>;
export type MarkNotificationReadResponse = z.infer<typeof markNotificationReadResponseSchema>;
export type NotificationCreatedRealtimeEvent = z.infer<
  typeof notificationCreatedRealtimeEventSchema
>;

import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date-primitives.js';

export const notificationKindSchema = z.enum([
  'CHAT_THREAD_CREATED',
  'REPORT_RECEIVED',
  'REPORT_STATUS_UPDATED',
  'PROFILE_MISMATCH_FEEDBACK',
  'SEASON_SYSTEM_NOTICE',
  'SUPPORT_TICKET_CREATED',
  'SUPPORT_TICKET_REPLIED',
  'SUPPORT_TICKET_ACTION_REQUIRED',
  'SUPPORT_APPEAL_RESOLVED',
]);
export const notificationSourceTypeSchema = z.enum([
  'CONVERSATION_THREAD',
  'REPORT_CASE',
  'SUPPORT_TICKET',
  'SEASON',
  'SYSTEM',
]);

export const chatThreadCreatedNotificationPayloadSchema = z.strictObject({
  threadId: z.string().min(1),
  actorUserId: z.string().min(1),
  recipientUserId: z.string().min(1),
  occurredAt: isoDateTimeStringSchema,
});

export const reportReceivedNotificationPayloadSchema = z.strictObject({
  reportId: z.string().min(1),
  status: z.literal('RECEIVED'),
  occurredAt: isoDateTimeStringSchema,
});

export const reportStatusUpdatedNotificationPayloadSchema = z.strictObject({
  reportId: z.string().min(1),
  status: z.enum(['UNDER_REVIEW', 'RESOLVED']),
  occurredAt: isoDateTimeStringSchema,
});

export const profileMismatchFeedbackNotificationPayloadSchema = z.strictObject({
  reportId: z.string().min(1),
  promptCode: z.literal('PROFILE_REVIEW_NEXT_SEASON'),
  occurredAt: isoDateTimeStringSchema,
});

export const seasonSystemNoticeNotificationPayloadSchema = z.strictObject({
  campaignId: z.string().min(1),
  seasonId: z.string().min(1).nullable().optional(),
  noticeCode: z.string().min(1),
  occurredAt: isoDateTimeStringSchema,
});

export const supportTicketCreatedNotificationPayloadSchema = z.strictObject({
  supportTicketId: z.string().min(1),
  category: z.string().min(1),
  status: z.literal('OPEN'),
  occurredAt: isoDateTimeStringSchema,
});

export const supportTicketRepliedNotificationPayloadSchema = z.strictObject({
  supportTicketId: z.string().min(1),
  status: z.enum(['WAITING_USER', 'RESOLVED', 'CLOSED']),
  occurredAt: isoDateTimeStringSchema,
});

export const supportTicketActionRequiredNotificationPayloadSchema = z.strictObject({
  supportTicketId: z.string().min(1),
  actionCode: z.string().min(1),
  occurredAt: isoDateTimeStringSchema,
});

export const supportAppealResolvedNotificationPayloadSchema = z.strictObject({
  supportTicketId: z.string().min(1),
  appealId: z.string().min(1),
  resultCode: z.string().min(1),
  occurredAt: isoDateTimeStringSchema,
});

export const notificationPayloadSchema = z.discriminatedUnion('kind', [
  chatThreadCreatedNotificationPayloadSchema.extend({
    kind: z.literal('CHAT_THREAD_CREATED'),
  }),
  reportReceivedNotificationPayloadSchema.extend({
    kind: z.literal('REPORT_RECEIVED'),
  }),
  reportStatusUpdatedNotificationPayloadSchema.extend({
    kind: z.literal('REPORT_STATUS_UPDATED'),
  }),
  profileMismatchFeedbackNotificationPayloadSchema.extend({
    kind: z.literal('PROFILE_MISMATCH_FEEDBACK'),
  }),
  seasonSystemNoticeNotificationPayloadSchema.extend({
    kind: z.literal('SEASON_SYSTEM_NOTICE'),
  }),
  supportTicketCreatedNotificationPayloadSchema.extend({
    kind: z.literal('SUPPORT_TICKET_CREATED'),
  }),
  supportTicketRepliedNotificationPayloadSchema.extend({
    kind: z.literal('SUPPORT_TICKET_REPLIED'),
  }),
  supportTicketActionRequiredNotificationPayloadSchema.extend({
    kind: z.literal('SUPPORT_TICKET_ACTION_REQUIRED'),
  }),
  supportAppealResolvedNotificationPayloadSchema.extend({
    kind: z.literal('SUPPORT_APPEAL_RESOLVED'),
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

export const markAllNotificationsReadResponseSchema = z.strictObject({
  updatedCount: z.number().int().min(0),
  readAt: isoDateTimeStringSchema,
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
export type ReportReceivedNotificationPayload = z.infer<
  typeof reportReceivedNotificationPayloadSchema
>;
export type ReportStatusUpdatedNotificationPayload = z.infer<
  typeof reportStatusUpdatedNotificationPayloadSchema
>;
export type ProfileMismatchFeedbackNotificationPayload = z.infer<
  typeof profileMismatchFeedbackNotificationPayloadSchema
>;
export type SeasonSystemNoticeNotificationPayload = z.infer<
  typeof seasonSystemNoticeNotificationPayloadSchema
>;
export type SupportTicketCreatedNotificationPayload = z.infer<
  typeof supportTicketCreatedNotificationPayloadSchema
>;
export type SupportTicketRepliedNotificationPayload = z.infer<
  typeof supportTicketRepliedNotificationPayloadSchema
>;
export type SupportTicketActionRequiredNotificationPayload = z.infer<
  typeof supportTicketActionRequiredNotificationPayloadSchema
>;
export type SupportAppealResolvedNotificationPayload = z.infer<
  typeof supportAppealResolvedNotificationPayloadSchema
>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type UserNotification = z.infer<typeof userNotificationSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type NotificationUnreadCountResponse = z.infer<typeof notificationUnreadCountResponseSchema>;
export type MarkNotificationReadResponse = z.infer<typeof markNotificationReadResponseSchema>;
export type MarkAllNotificationsReadResponse = z.infer<
  typeof markAllNotificationsReadResponseSchema
>;
export type NotificationCreatedRealtimeEvent = z.infer<
  typeof notificationCreatedRealtimeEventSchema
>;

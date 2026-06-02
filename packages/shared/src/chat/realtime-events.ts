import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date-primitives.js';
import {
  conversationMessageBodyStateSchema,
  conversationMessageTombstoneReasonSchema,
  conversationThreadClosedReasonSchema,
  conversationThreadStatusSchema,
} from './enums.js';
import { conversationMessageSchema } from './thread.js';
import { notificationCreatedRealtimeEventSchema } from '../notifications/contract.js';

const chatRealtimeEventBaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  occurredAt: isoDateTimeStringSchema,
  cursor: z.string().min(1),
  threadId: z.string().min(1).optional(),
});

export const chatRealtimeEventEnvelopeSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.string().min(1),
  payload: z.unknown(),
});

export const chatThreadUpdatedEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.thread.updated'),
  threadId: z.string().min(1),
  payload: z.strictObject({
    threadId: z.string().min(1),
    status: conversationThreadStatusSchema,
    closedReason: conversationThreadClosedReasonSchema.nullable(),
  }),
});

export const chatThreadArchivedEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.thread.archived'),
  threadId: z.string().min(1),
  payload: z.strictObject({
    threadId: z.string().min(1),
    closedAt: isoDateTimeStringSchema,
    closedReason: conversationThreadClosedReasonSchema.nullable(),
  }),
});

export const chatMemberLeftEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.member.left'),
  threadId: z.string().min(1),
  payload: z.strictObject({
    threadId: z.string().min(1),
    participantId: z.string().min(1),
    userId: z.string().min(1),
    leftAt: isoDateTimeStringSchema,
  }),
});

export const chatMessageCreatedEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.message.created'),
  threadId: z.string().min(1),
  payload: z.strictObject({
    message: conversationMessageSchema,
  }),
});

export const chatMessageTombstonedEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.message.tombstoned'),
  threadId: z.string().min(1),
  payload: z.strictObject({
    messageId: z.string().min(1),
    body: z.string().min(1),
    bodyState: conversationMessageBodyStateSchema.extract(['TOMBSTONED', 'DISPOSED']),
    tombstoneReason: conversationMessageTombstoneReasonSchema,
    bodyVersion: z.number().int().min(1),
  }),
});

export const chatReadMarkerUpdatedEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.read_marker.updated'),
  threadId: z.string().min(1),
  payload: z.strictObject({
    threadId: z.string().min(1),
    lastReadMessageId: z.string().min(1),
    unreadCount: z.number().int().min(0).optional(),
  }),
});

export const chatResyncRequiredEventSchema = chatRealtimeEventBaseSchema.extend({
  eventType: z.literal('chat.resync.required'),
  payload: z.strictObject({
    reason: z.enum(['CURSOR_EXPIRED', 'CURSOR_INVALID', 'SCHEMA_UNSUPPORTED', 'PRIVACY_GUARD']),
  }),
});

export const chatRealtimeEventSchema = z.discriminatedUnion('eventType', [
  chatThreadUpdatedEventSchema,
  chatThreadArchivedEventSchema,
  chatMemberLeftEventSchema,
  chatMessageCreatedEventSchema,
  chatMessageTombstonedEventSchema,
  chatReadMarkerUpdatedEventSchema,
  chatResyncRequiredEventSchema,
  notificationCreatedRealtimeEventSchema,
]);

export type ChatRealtimeEventEnvelope = z.infer<typeof chatRealtimeEventEnvelopeSchema>;
export type ChatThreadUpdatedEvent = z.infer<typeof chatThreadUpdatedEventSchema>;
export type ChatThreadArchivedEvent = z.infer<typeof chatThreadArchivedEventSchema>;
export type ChatMemberLeftEvent = z.infer<typeof chatMemberLeftEventSchema>;
export type ChatMessageCreatedEvent = z.infer<typeof chatMessageCreatedEventSchema>;
export type ChatMessageTombstonedEvent = z.infer<typeof chatMessageTombstonedEventSchema>;
export type ChatReadMarkerUpdatedEvent = z.infer<typeof chatReadMarkerUpdatedEventSchema>;
export type ChatResyncRequiredEvent = z.infer<typeof chatResyncRequiredEventSchema>;
export type ChatRealtimeEvent = z.infer<typeof chatRealtimeEventSchema>;

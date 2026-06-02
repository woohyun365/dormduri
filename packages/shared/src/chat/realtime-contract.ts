import { z } from 'zod';
import { chatRealtimeEventSchema } from './realtime-events.js';

export const updateChatReadMarkerRequestSchema = z.strictObject({
  lastReadMessageId: z.string().min(1),
});

export const chatRealtimeReplaySuccessResponseSchema = z.strictObject({
  ok: z.literal(true),
  events: z.array(chatRealtimeEventSchema),
  nextCursor: z.string().min(1).nullable(),
  hasMore: z.boolean(),
});

export const chatRealtimeReplayFailureReasonSchema = z.enum([
  'CURSOR_EXPIRED',
  'CURSOR_INVALID',
  'SCHEMA_UNSUPPORTED',
  'PRIVACY_GUARD',
]);

export const chatRealtimeReplayFailureResponseSchema = z.strictObject({
  ok: z.literal(false),
  reason: chatRealtimeReplayFailureReasonSchema,
  resyncRequired: z.literal(true),
});

export const chatRealtimeReplayResponseSchema = z.discriminatedUnion('ok', [
  chatRealtimeReplaySuccessResponseSchema,
  chatRealtimeReplayFailureResponseSchema,
]);

export type UpdateChatReadMarkerRequest = z.infer<typeof updateChatReadMarkerRequestSchema>;
export type ChatRealtimeReplaySuccessResponse = z.infer<
  typeof chatRealtimeReplaySuccessResponseSchema
>;
export type ChatRealtimeReplayFailureReason = z.infer<typeof chatRealtimeReplayFailureReasonSchema>;
export type ChatRealtimeReplayFailureResponse = z.infer<
  typeof chatRealtimeReplayFailureResponseSchema
>;
export type ChatRealtimeReplayResponse = z.infer<typeof chatRealtimeReplayResponseSchema>;

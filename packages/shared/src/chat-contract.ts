import { z } from 'zod';
import { isoDateTimeStringSchema } from './date-primitives.js';

export const conversationThreadKindSchema = z.enum(['DIRECT', 'MATCHED']);
export const conversationThreadStatusSchema = z.enum(['OPEN', 'READ_ONLY', 'ARCHIVED']);
export const conversationThreadClosedReasonSchema = z.enum([
  'ACTIVE_MATCH_CREATED',
  'ROOM_SELECTION_CUTOFF',
  'SEASON_ENDED',
  'PARTICIPANT_WITHDRAWN',
  'MODERATION',
  'ADMIN_ACTION',
]);

export const conversationMessageSchema = z.strictObject({
  id: z.string(),
  senderUserId: z.string(),
  body: z.string(),
  sentAt: isoDateTimeStringSchema,
});

export const conversationThreadSummarySchema = z.strictObject({
  id: z.string(),
  seasonId: z.string(),
  counterpartUserId: z.string(),
  counterpartParticipantId: z.string(),
  threadKind: conversationThreadKindSchema,
  status: conversationThreadStatusSchema,
  closedReason: conversationThreadClosedReasonSchema.nullable(),
  closedAt: isoDateTimeStringSchema.nullable(),
  lastMessageAt: isoDateTimeStringSchema.nullable(),
  canSendMessage: z.boolean(),
  canReport: z.boolean(),
});

export const conversationThreadListResponseSchema = z.strictObject({
  items: z.array(conversationThreadSummarySchema),
});

export const conversationThreadEntryResponseSchema = z.strictObject({
  targetUserId: z.string(),
  thread: conversationThreadSummarySchema.nullable(),
  canEnterChatUi: z.boolean(),
  canSendMessage: z.boolean(),
});

export const conversationThreadDetailResponseSchema = z.strictObject({
  thread: conversationThreadSummarySchema,
  messages: z.array(conversationMessageSchema),
});

export const sendConversationMessageRequestSchema = z.strictObject({
  targetUserId: z.string(),
  body: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0),
});

export const leaveConversationThreadResponseSchema = z.strictObject({
  threadId: z.string(),
  archived: z.boolean(),
});

export const sendConversationMessageResponseSchema = z.strictObject({
  thread: conversationThreadSummarySchema,
  message: conversationMessageSchema,
  createdThread: z.boolean(),
});

export type ConversationThreadKind = z.infer<typeof conversationThreadKindSchema>;
export type ConversationThreadStatus = z.infer<typeof conversationThreadStatusSchema>;
export type ConversationThreadClosedReason = z.infer<typeof conversationThreadClosedReasonSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationThreadSummary = z.infer<typeof conversationThreadSummarySchema>;
export type ConversationThreadListResponse = z.infer<typeof conversationThreadListResponseSchema>;
export type ConversationThreadEntryResponse = z.infer<typeof conversationThreadEntryResponseSchema>;
export type ConversationThreadDetailResponse = z.infer<
  typeof conversationThreadDetailResponseSchema
>;
export type SendConversationMessageRequest = z.infer<typeof sendConversationMessageRequestSchema>;
export type LeaveConversationThreadResponse = z.infer<typeof leaveConversationThreadResponseSchema>;
export type SendConversationMessageResponse = z.infer<typeof sendConversationMessageResponseSchema>;

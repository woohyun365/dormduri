import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date-primitives.js';
import {
  conversationMessageBodyStateSchema,
  conversationMessageTombstoneReasonSchema,
  conversationThreadClosedReasonSchema,
  conversationThreadKindSchema,
  conversationThreadStatusSchema,
} from './enums.js';

export const chatSendMessageUnavailableReasonSchema = z.enum([
  'THREAD_READ_ONLY',
  'ARCHIVED_THREAD',
  'MEMBER_LEFT',
  'NOT_MATCHED_PARTNER_RESULT',
  'DIRECT_ACTION_NOT_ALLOWED',
  'SEASON_ENDED',
  'TARGET_DELETED_OR_DEIDENTIFIED',
  'SAFETY_OR_VISIBILITY_RESTRICTED',
]);

export const conversationMessageSchema = z.strictObject({
  id: z.string(),
  senderUserId: z.string(),
  body: z.string(),
  bodyState: conversationMessageBodyStateSchema,
  tombstoneReason: conversationMessageTombstoneReasonSchema.nullable(),
  bodyVersion: z.number().int().min(1),
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
  sendMessageUnavailableReason: chatSendMessageUnavailableReasonSchema.nullable(),
  canReport: z.boolean(),
});

export type ChatSendMessageUnavailableReason = z.infer<
  typeof chatSendMessageUnavailableReasonSchema
>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationThreadSummary = z.infer<typeof conversationThreadSummarySchema>;

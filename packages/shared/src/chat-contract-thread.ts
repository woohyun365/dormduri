import { z } from 'zod';
import { isoDateTimeStringSchema } from './date-primitives.js';
import {
  conversationThreadClosedReasonSchema,
  conversationThreadKindSchema,
  conversationThreadStatusSchema,
} from './chat-contract-enums.js';

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

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationThreadSummary = z.infer<typeof conversationThreadSummarySchema>;

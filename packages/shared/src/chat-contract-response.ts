import { z } from 'zod';
import {
  conversationMessageSchema,
  conversationThreadSummarySchema,
} from './chat-contract-thread.js';

export const conversationThreadListPageInfoSchema = z.strictObject({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
});

export const conversationThreadListResponseSchema = z.strictObject({
  items: z.array(conversationThreadSummarySchema),
  pageInfo: conversationThreadListPageInfoSchema,
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

export const leaveConversationThreadResponseSchema = z.strictObject({
  threadId: z.string(),
  archived: z.boolean(),
});

export const sendConversationMessageResponseSchema = z.strictObject({
  thread: conversationThreadSummarySchema,
  message: conversationMessageSchema,
  createdThread: z.boolean(),
});

export type ConversationThreadListResponse = z.infer<typeof conversationThreadListResponseSchema>;
export type ConversationThreadEntryResponse = z.infer<typeof conversationThreadEntryResponseSchema>;
export type ConversationThreadDetailResponse = z.infer<
  typeof conversationThreadDetailResponseSchema
>;
export type LeaveConversationThreadResponse = z.infer<typeof leaveConversationThreadResponseSchema>;
export type SendConversationMessageResponse = z.infer<typeof sendConversationMessageResponseSchema>;

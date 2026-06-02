import { z } from 'zod';

export const listConversationThreadsQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().min(1).max(512).nullable().optional(),
});

export const sendConversationMessageRequestSchema = z.strictObject({
  targetUserId: z.string(),
  body: z.string().trim().min(1).max(1000),
  clientMessageId: z.string().trim().min(1).max(128),
});

export type ListConversationThreadsQuery = z.infer<typeof listConversationThreadsQuerySchema>;
export type SendConversationMessageRequest = z.infer<typeof sendConversationMessageRequestSchema>;

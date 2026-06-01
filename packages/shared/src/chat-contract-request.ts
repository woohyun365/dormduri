import { z } from 'zod';

export const sendConversationMessageRequestSchema = z.strictObject({
  targetUserId: z.string(),
  body: z.string().trim().min(1).max(1000),
  clientMessageId: z.string().trim().min(1).max(128),
});

export type SendConversationMessageRequest = z.infer<typeof sendConversationMessageRequestSchema>;

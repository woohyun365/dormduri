import { z } from 'zod';

export const sendConversationMessageRequestSchema = z.strictObject({
  targetUserId: z.string(),
  body: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0),
});

export type SendConversationMessageRequest = z.infer<typeof sendConversationMessageRequestSchema>;

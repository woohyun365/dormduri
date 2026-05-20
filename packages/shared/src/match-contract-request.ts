import { z } from 'zod';

export const createMatchRequestSchema = z.strictObject({
  targetUserId: z.string(),
  note: z.string().trim().max(100).nullable().optional(),
});

export type CreateMatchRequestRequest = z.infer<typeof createMatchRequestSchema>;

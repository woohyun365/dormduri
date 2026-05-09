import { z } from 'zod';
import { matchRequestChannelSchema } from './match-contract-enums.js';

export const createMatchRequestSchema = z.strictObject({
  targetUserId: z.string(),
  note: z.string().trim().max(100).nullable().optional(),
  channel: matchRequestChannelSchema.optional(),
});

export type CreateMatchRequestRequest = z.infer<typeof createMatchRequestSchema>;

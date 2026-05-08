import { z } from 'zod';
import { authenticatedSessionUserSchema } from './user-contract.js';

export const sessionResponseSchema = z.strictObject({
  authenticated: z.boolean(),
  user: authenticatedSessionUserSchema.optional(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

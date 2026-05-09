import { z } from 'zod';

export const genericErrorResponseSchema = z.strictObject({
  success: z.boolean(),
  error: z.string().optional(),
  code: z.string().optional(),
  userActionable: z.boolean().optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export type GenericErrorResponse = z.infer<typeof genericErrorResponseSchema>;

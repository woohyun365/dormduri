import { z } from 'zod';

export const profileListQuerySchema = z
  .strictObject({
    offset: z.coerce.number().int().nonnegative().optional().default(0),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  })
  .default({ offset: 0, limit: 20 });

export const nicknamePatchRequestSchema = z.strictObject({
  nickname: z.string(),
});

export type ProfileListQuery = z.infer<typeof profileListQuerySchema>;

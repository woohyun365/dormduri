import { z } from 'zod';

export const nicknamePatchRequestSchema = z.strictObject({
  nickname: z.string(),
});

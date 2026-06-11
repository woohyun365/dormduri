import { z } from 'zod';
import { activeMatchSummarySchema, matchRequestSummarySchema } from './summary.js';

export const matchRequestListResponseSchema = z.strictObject({
  items: z.array(matchRequestSummarySchema),
});

export const activeMatchResponseSchema = z.strictObject({
  activeMatch: activeMatchSummarySchema.nullable(),
});

export const activeMatchActionResponseSchema = z.strictObject({
  activeMatch: activeMatchSummarySchema,
});

export const matchRequestActionResponseSchema = z.strictObject({
  request: matchRequestSummarySchema,
  activeMatch: activeMatchSummarySchema.nullable(),
});

export type MatchRequestListResponse = z.infer<typeof matchRequestListResponseSchema>;
export type ActiveMatchResponse = z.infer<typeof activeMatchResponseSchema>;
export type ActiveMatchActionResponse = z.infer<typeof activeMatchActionResponseSchema>;
export type MatchRequestActionResponse = z.infer<typeof matchRequestActionResponseSchema>;

import { z } from 'zod';
import { isoDateTimeStringSchema, localDateStringSchema } from '../../date/primitives.js';
import { seasonStateSchema } from '../../season/runtime/primitives.js';
import { matchCapabilityReasonSchema } from './enums.js';
import {
  activeMatchSummarySchema,
  matchRequestSummarySchema,
  matchRequestWithActionsSchema,
} from './summary.js';

export const matchOverviewSeasonSchema = z.strictObject({
  id: z.string().nullable(),
  state: seasonStateSchema,
  roomSelectionDate: localDateStringSchema.nullable(),
});

export const matchOverviewCapabilitySchema = z.strictObject({
  canViewMatching: z.boolean(),
  reason: matchCapabilityReasonSchema.nullable(),
});

/**
 * current request rows와 active relation은 API의 단일 serializable read에서 파생한다.
 * history는 별도 ownership/phase로 분리한다. pair-only 제품 계약에는 group projection이 없다.
 */
export const matchOverviewResponseSchema = z.strictObject({
  serverNow: isoDateTimeStringSchema,
  season: matchOverviewSeasonSchema,
  capability: matchOverviewCapabilitySchema,
  sentRequests: z.array(matchRequestWithActionsSchema),
  receivedRequests: z.array(matchRequestWithActionsSchema),
  activeMatch: activeMatchSummarySchema.nullable(),
});

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
export type MatchOverviewSeason = z.infer<typeof matchOverviewSeasonSchema>;
export type MatchOverviewCapability = z.infer<typeof matchOverviewCapabilitySchema>;
export type MatchOverviewResponse = z.infer<typeof matchOverviewResponseSchema>;

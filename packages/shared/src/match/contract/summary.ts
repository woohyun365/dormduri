import { z } from 'zod';
import { isoDateTimeStringSchema } from '../../date/primitives.js';
import { roommateSearchSummarySchema } from '../../roommate-search/contract/index.js';
import {
  activeMatchEndReasonSchema,
  activeMatchStatusSchema,
  activeMatchUnmatchProgressStateSchema,
  matchActionDisabledReasonSchema,
  matchRequestStatusSchema,
  matchRequestTerminalReasonSchema,
  requestDirectionSchema,
} from './enums.js';

export const matchRequestActionsSchema = z.strictObject({
  canAccept: z.boolean(),
  canReject: z.boolean(),
  canCancel: z.boolean(),
  disabledReason: matchActionDisabledReasonSchema.nullable(),
});

export const activeMatchUnmatchProgressSchema = z.strictObject({
  state: activeMatchUnmatchProgressStateSchema,
  requestedByViewerAt: isoDateTimeStringSchema.nullable(),
  requestedByCounterpartAt: isoDateTimeStringSchema.nullable(),
  progressCount: z.number().int().min(0).max(2),
  requiredCount: z.literal(2),
  canRequest: z.boolean(),
  canCancel: z.boolean(),
  availableUntil: isoDateTimeStringSchema.nullable(),
});

export const matchRequestSummarySchema = z.strictObject({
  id: z.string(),
  seasonId: z.string(),
  direction: requestDirectionSchema,
  counterpartUserId: z.string(),
  counterpartParticipantId: z.string(),
  counterpartSummary: roommateSearchSummarySchema,
  status: matchRequestStatusSchema,
  note: z.string().nullable(),
  createdAt: isoDateTimeStringSchema,
  expiresAt: isoDateTimeStringSchema,
  terminalAt: isoDateTimeStringSchema.nullable(),
  acceptedAt: isoDateTimeStringSchema.nullable(),
  terminalReason: matchRequestTerminalReasonSchema.nullable(),
  actions: matchRequestActionsSchema.optional(),
});

/** overview read는 row별 action capability를 항상 함께 제공한다. */
export const matchRequestWithActionsSchema = matchRequestSummarySchema.extend({
  actions: matchRequestActionsSchema,
});

export const activeMatchSummarySchema = z.strictObject({
  id: z.string(),
  seasonId: z.string(),
  counterpartUserId: z.string(),
  counterpartParticipantId: z.string(),
  counterpartNickname: z.string().optional(),
  counterpartSummary: roommateSearchSummarySchema.optional(),
  status: activeMatchStatusSchema,
  startedAt: isoDateTimeStringSchema,
  endedAt: isoDateTimeStringSchema.nullable(),
  endReason: activeMatchEndReasonSchema.nullable(),
  createdFromRequestId: z.string(),
  matchScore: z.number().int().min(0).max(100).optional(),
  unmatchProgress: activeMatchUnmatchProgressSchema,
});

export type ActiveMatchUnmatchProgress = z.infer<typeof activeMatchUnmatchProgressSchema>;
export type MatchRequestActions = z.infer<typeof matchRequestActionsSchema>;
export type MatchRequestSummary = z.infer<typeof matchRequestSummarySchema>;
export type MatchRequestWithActions = z.infer<typeof matchRequestWithActionsSchema>;
export type ActiveMatchSummary = z.infer<typeof activeMatchSummarySchema>;

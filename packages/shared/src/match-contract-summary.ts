import { z } from 'zod';
import { isoDateTimeStringSchema } from './date-primitives.js';
import {
  activeMatchEndReasonSchema,
  activeMatchStatusSchema,
  activeMatchUnmatchProgressStateSchema,
  matchRequestChannelSchema,
  matchRequestStatusSchema,
  matchRequestTerminalReasonSchema,
  requestDirectionSchema,
} from './match-contract-enums.js';

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
  status: matchRequestStatusSchema,
  note: z.string().nullable(),
  createdAt: isoDateTimeStringSchema,
  expiresAt: isoDateTimeStringSchema,
  terminalAt: isoDateTimeStringSchema.nullable(),
  acceptedAt: isoDateTimeStringSchema.nullable(),
  terminalReason: matchRequestTerminalReasonSchema.nullable(),
  requestChannel: matchRequestChannelSchema.nullable(),
});

export const activeMatchSummarySchema = z.strictObject({
  id: z.string(),
  seasonId: z.string(),
  counterpartUserId: z.string(),
  counterpartParticipantId: z.string(),
  counterpartNickname: z.string().optional(),
  status: activeMatchStatusSchema,
  startedAt: isoDateTimeStringSchema,
  endedAt: isoDateTimeStringSchema.nullable(),
  endReason: activeMatchEndReasonSchema.nullable(),
  createdFromRequestId: z.string(),
  matchScore: z.number().int().min(0).max(100).optional(),
  unmatchProgress: activeMatchUnmatchProgressSchema,
});

export type ActiveMatchUnmatchProgress = z.infer<typeof activeMatchUnmatchProgressSchema>;
export type MatchRequestSummary = z.infer<typeof matchRequestSummarySchema>;
export type ActiveMatchSummary = z.infer<typeof activeMatchSummarySchema>;

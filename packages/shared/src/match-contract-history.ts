import { z } from 'zod';
import { isoDateTimeStringSchema } from './date/primitives.js';
import {
  activeMatchEndReasonSchema,
  matchRequestTerminalReasonSchema,
} from './match-contract-enums.js';

export const matchHistoryStageSchema = z.enum(['SENT_REQUEST', 'RECEIVED_REQUEST', 'MATCH']);

export const matchHistoryEntryResultSchema = z.enum([
  'REQUEST_REJECTED',
  'REQUEST_CANCELLED',
  'REQUEST_EXPIRED',
  'MATCHED_SUCCESS',
  'UNMATCHED_AFTER_SUCCESS',
]);

export const matchHistorySeasonFinalResultSchema = z.enum([
  'NO_MATCH',
  'MATCHED_SUCCESS',
  'UNMATCHED_AFTER_SUCCESS',
]);

export const matchHistoryEntrySchema = z.strictObject({
  id: z.string(),
  counterpartParticipantId: z.string(),
  counterpartNickname: z.string(),
  stage: matchHistoryStageSchema,
  result: matchHistoryEntryResultSchema,
  viewerRequested: z.boolean(),
  matchedAt: isoDateTimeStringSchema.nullable(),
  unmatchedAt: isoDateTimeStringSchema.nullable(),
  finalizedAt: isoDateTimeStringSchema,
  requestTerminalReason: matchRequestTerminalReasonSchema.nullable(),
  activeMatchEndReason: activeMatchEndReasonSchema.nullable(),
});

export const matchHistorySeasonSummarySchema = z.strictObject({
  seasonId: z.string(),
  seasonName: z.string(),
  viewerParticipantId: z.string(),
  viewerDormitoryIdSnapshot: z.string().nullable(),
  finalResult: matchHistorySeasonFinalResultSchema,
  sentRequestCount: z.number().int().nonnegative(),
  receivedRequestCount: z.number().int().nonnegative(),
  history: z.array(matchHistoryEntrySchema),
});

export const matchHistoryResponseSchema = z.strictObject({
  items: z.array(matchHistorySeasonSummarySchema),
});

export type MatchHistoryStage = z.infer<typeof matchHistoryStageSchema>;
export type MatchHistoryEntryResult = z.infer<typeof matchHistoryEntryResultSchema>;
export type MatchHistorySeasonFinalResult = z.infer<typeof matchHistorySeasonFinalResultSchema>;
export type MatchHistoryEntry = z.infer<typeof matchHistoryEntrySchema>;
export type MatchHistorySeasonSummary = z.infer<typeof matchHistorySeasonSummarySchema>;
export type MatchHistoryResponse = z.infer<typeof matchHistoryResponseSchema>;

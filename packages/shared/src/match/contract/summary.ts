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

export const matchActionDecisionSchema = z.strictObject({
  allowed: z.boolean(),
  reason: matchActionDisabledReasonSchema.nullable(),
});

/**
 * 요청 row의 각 mutation은 서로 다른 precondition을 가진다.
 * 예를 들어 수락이 stale precondition으로 닫혀도 거절은 여전히 가능할 수 있으므로
 * 하나의 공용 disabledReason으로 세 action을 뭉치지 않는다.
 */
export const matchRequestActionsSchema = z.strictObject({
  accept: matchActionDecisionSchema,
  reject: matchActionDecisionSchema,
  cancel: matchActionDecisionSchema,
});

export const activeMatchUnmatchProgressSchema = z.strictObject({
  state: activeMatchUnmatchProgressStateSchema,
  requestedByViewerAt: isoDateTimeStringSchema.nullable(),
  requestedByCounterpartAt: isoDateTimeStringSchema.nullable(),
  progressCount: z.number().int().min(0).max(2),
  requiredCount: z.literal(2),
  canRequest: z.boolean(),
  canCancel: z.boolean(),
  disabledReason: matchActionDisabledReasonSchema.nullable(),
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

/** current read model은 종료되지 않은 ACTIVE 관계만 표현한다. */
export const currentActiveMatchSummarySchema = activeMatchSummarySchema.extend({
  status: z.literal('ACTIVE'),
  endedAt: z.null(),
  endReason: z.null(),
});

export type ActiveMatchUnmatchProgress = z.infer<typeof activeMatchUnmatchProgressSchema>;
export type MatchActionDecision = z.infer<typeof matchActionDecisionSchema>;
export type MatchRequestActions = z.infer<typeof matchRequestActionsSchema>;
export type MatchRequestSummary = z.infer<typeof matchRequestSummarySchema>;
export type MatchRequestWithActions = z.infer<typeof matchRequestWithActionsSchema>;
export type ActiveMatchSummary = z.infer<typeof activeMatchSummarySchema>;
export type CurrentActiveMatchSummary = z.infer<typeof currentActiveMatchSummarySchema>;

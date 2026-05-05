import { z } from 'zod';
import { isoDateTimeStringSchema } from './date-primitives.js';

export const matchRequestChannelSchema = z.enum([
  'ROOMMATE_TAB',
  'PROFILE_DETAIL',
  'RECOMMENDATION',
  'ADMIN',
]);

export const matchRequestStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED_BY_REQUESTER',
  'CANCELLED_BY_SYSTEM',
  'EXPIRED',
]);

export const matchRequestTerminalReasonSchema = z.enum([
  'ACCEPTED',
  'REJECTED_BY_RECEIVER',
  'CANCELLED_BY_REQUESTER',
  'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
  'EXPIRED',
  'WITHDRAWN_PARTICIPANT',
  'ADMIN_ACTION',
]);

export const activeMatchStatusSchema = z.enum([
  'ACTIVE',
  'UNMATCHED',
  'SEASON_ENDED',
  'ADMIN_ENDED',
]);

export const activeMatchEndReasonSchema = z.enum([
  'UNMATCHED_BY_MUTUAL_CONSENT',
  'SEASON_ENDED',
  'ADMIN_ACTION',
  'WITHDRAWN_PARTICIPANT',
]);

export const requestDirectionSchema = z.enum(['SENT', 'RECEIVED']);

export const createMatchRequestSchema = z.strictObject({
  targetUserId: z.string(),
  note: z.string().trim().max(100).nullable().optional(),
  channel: matchRequestChannelSchema.optional(),
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

export const matchRequestListResponseSchema = z.strictObject({
  items: z.array(matchRequestSummarySchema),
});

export const activeMatchSummarySchema = z.strictObject({
  id: z.string(),
  seasonId: z.string(),
  counterpartUserId: z.string(),
  counterpartParticipantId: z.string(),
  status: activeMatchStatusSchema,
  startedAt: isoDateTimeStringSchema,
  endedAt: isoDateTimeStringSchema.nullable(),
  endReason: activeMatchEndReasonSchema.nullable(),
  createdFromRequestId: z.string(),
});

export const activeMatchResponseSchema = z.strictObject({
  activeMatch: activeMatchSummarySchema.nullable(),
});

export const matchRequestActionResponseSchema = z.strictObject({
  request: matchRequestSummarySchema,
  activeMatch: activeMatchSummarySchema.nullable(),
});

export type MatchRequestChannel = z.infer<typeof matchRequestChannelSchema>;
export type MatchRequestStatus = z.infer<typeof matchRequestStatusSchema>;
export type MatchRequestTerminalReason = z.infer<typeof matchRequestTerminalReasonSchema>;
export type ActiveMatchStatus = z.infer<typeof activeMatchStatusSchema>;
export type ActiveMatchEndReason = z.infer<typeof activeMatchEndReasonSchema>;
export type RequestDirection = z.infer<typeof requestDirectionSchema>;
export type CreateMatchRequestRequest = z.infer<typeof createMatchRequestSchema>;
export type MatchRequestSummary = z.infer<typeof matchRequestSummarySchema>;
export type MatchRequestListResponse = z.infer<typeof matchRequestListResponseSchema>;
export type ActiveMatchSummary = z.infer<typeof activeMatchSummarySchema>;
export type ActiveMatchResponse = z.infer<typeof activeMatchResponseSchema>;
export type MatchRequestActionResponse = z.infer<typeof matchRequestActionResponseSchema>;

import { z } from 'zod';

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

export const activeMatchUnmatchProgressStateSchema = z.enum([
  'NONE',
  'WAITING_FOR_COUNTERPART',
  'WAITING_FOR_ME',
  'COMPLETED',
]);

export const requestDirectionSchema = z.enum(['SENT', 'RECEIVED']);

export type MatchRequestChannel = z.infer<typeof matchRequestChannelSchema>;
export type MatchRequestStatus = z.infer<typeof matchRequestStatusSchema>;
export type MatchRequestTerminalReason = z.infer<typeof matchRequestTerminalReasonSchema>;
export type ActiveMatchStatus = z.infer<typeof activeMatchStatusSchema>;
export type ActiveMatchEndReason = z.infer<typeof activeMatchEndReasonSchema>;
export type ActiveMatchUnmatchProgressState = z.infer<typeof activeMatchUnmatchProgressStateSchema>;
export type RequestDirection = z.infer<typeof requestDirectionSchema>;

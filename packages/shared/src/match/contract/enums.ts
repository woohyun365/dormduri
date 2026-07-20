import { z } from 'zod';

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
  'MATCH_PRECONDITION_FAILED',
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

/**
 * 현재 viewer가 matching overview를 읽을 수 없는 public 사유다.
 * 내부 moderation/audit reason은 이 contract에 포함하지 않는다.
 */
export const matchCapabilityReasonSchema = z.enum([
  'CAMPUS_NOT_OPERATED',
  'VIEWER_NOT_REGISTERED',
  'SEASON_NOT_ACTIONABLE',
  'SAFETY_OR_VISIBILITY_RESTRICTED',
]);

/**
 * 현재 row/action을 실행할 수 없는 public 사유다. FE는 이 값을 다시 판정하지 않는다.
 */
export const matchActionDisabledReasonSchema = z.enum([
  'SEASON_NOT_ACTIONABLE',
  'ROOM_SELECTION_CUTOFF',
  'REQUEST_EXPIRED',
  'REQUEST_ALREADY_RESOLVED',
  'MATCH_PRECONDITION_FAILED',
  'ACTIVE_MATCH_NOT_ACTIONABLE',
  'UNMATCH_ALREADY_PENDING',
  'TARGET_UNAVAILABLE',
]);

export type MatchRequestStatus = z.infer<typeof matchRequestStatusSchema>;
export type MatchRequestTerminalReason = z.infer<typeof matchRequestTerminalReasonSchema>;
export type ActiveMatchStatus = z.infer<typeof activeMatchStatusSchema>;
export type ActiveMatchEndReason = z.infer<typeof activeMatchEndReasonSchema>;
export type ActiveMatchUnmatchProgressState = z.infer<typeof activeMatchUnmatchProgressStateSchema>;
export type RequestDirection = z.infer<typeof requestDirectionSchema>;
export type MatchCapabilityReason = z.infer<typeof matchCapabilityReasonSchema>;
export type MatchActionDisabledReason = z.infer<typeof matchActionDisabledReasonSchema>;

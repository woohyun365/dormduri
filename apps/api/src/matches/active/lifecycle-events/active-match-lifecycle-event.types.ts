import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  ActiveMatchLifecycleActorType,
  ActiveMatchLifecycleEventReason,
  ActiveMatchLifecycleEventType,
} from '../../../generated/prisma/enums.js';

export const ACTIVE_MATCH_LIFECYCLE_METADATA_KEYS = [
  'transitionOwner',
  'previousStatus',
  'nextStatus',
  'previousEndReason',
  'nextEndReason',
  'previousEndedAt',
  'nextEndedAt',
  'requestStatus',
  'unmatchRequestStatus',
  'expiredUnmatchRequestCount',
  'canceledPendingMatchRequests',
  'chatMatchedThreadUpdated',
  'chatDirectThreadsMarkedReadOnly',
  'chatDirectThreadsReopened',
  'seasonState',
  'roomSelectionDate',
] as const;

export type ActiveMatchLifecycleMetadataKey = (typeof ACTIVE_MATCH_LIFECYCLE_METADATA_KEYS)[number];

export type ActiveMatchLifecycleMetadataInput = Record<string, unknown>;

export interface ActiveMatchLifecycleEventCreateInput {
  activeMatchId: string;
  eventType: ActiveMatchLifecycleEventType;
  reason: ActiveMatchLifecycleEventReason;
  actorType: ActiveMatchLifecycleActorType;
  occurredAt: Date;
  actorUserId?: string;
  sourceMatchRequestId?: string;
  sourceUnmatchRequestId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface ActiveMatchLifecycleWriterBaseInput {
  activeMatchId: string;
  occurredAt: Date;
  metadata?: ActiveMatchLifecycleMetadataInput | null;
}

export interface ActiveMatchLifecycleUserInput extends ActiveMatchLifecycleWriterBaseInput {
  actorUserId: string;
}

export interface ActiveMatchCreatedInput extends ActiveMatchLifecycleUserInput {
  sourceMatchRequestId: string;
}

export interface ActiveMatchUnmatchRequestInput extends ActiveMatchLifecycleUserInput {
  sourceUnmatchRequestId: string;
}

export interface ActiveMatchUnmatchedInput extends ActiveMatchLifecycleUserInput {
  sourceUnmatchRequestId?: string;
}

export interface ActiveMatchSystemUnmatchRequestInput extends ActiveMatchLifecycleWriterBaseInput {
  sourceUnmatchRequestId: string;
}

export type ActiveMatchSeasonEndedInput = ActiveMatchLifecycleWriterBaseInput;

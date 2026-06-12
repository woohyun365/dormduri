import type { Prisma } from '../../generated/prisma/client.js';
import type {
  ConversationThreadLifecycleActorType,
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
} from '../../generated/prisma/enums.js';

export const CONVERSATION_THREAD_LIFECYCLE_EVENT_METADATA_ALLOWED_KEYS = [
  'sourceActiveMatchId',
  'sourceMatchRequestId',
  'sourceUnmatchRequestId',
  'sourceBlockId',
  'sourceReportCaseId',
  'sourceArchiveJobId',
  'previousStatus',
  'nextStatus',
  'previousThreadKind',
  'nextThreadKind',
  'previousClosedReason',
  'nextClosedReason',
] as const;

export type ConversationThreadLifecycleEventMetadataKey =
  (typeof CONVERSATION_THREAD_LIFECYCLE_EVENT_METADATA_ALLOWED_KEYS)[number];

export type ConversationThreadLifecycleEventMetadataInput = Record<string, unknown>;

export type ConversationThreadLifecycleEventMetadata = Partial<
  Record<ConversationThreadLifecycleEventMetadataKey, string | number | boolean | null>
>;

export interface ConversationThreadLifecycleEventCreateInput {
  threadId: string;
  eventType: ConversationThreadLifecycleEventType;
  reason: ConversationThreadLifecycleEventReason;
  actorType: ConversationThreadLifecycleActorType;
  sourceDomain: ConversationThreadLifecycleSourceDomain;
  actorUserId?: string;
  sourceActiveMatchId?: string;
  sourceMatchRequestId?: string;
  sourceUnmatchRequestId?: string;
  sourceBlockId?: string;
  sourceReportCaseId?: string;
  sourceArchiveJobId?: string;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
}

export type ConversationThreadLifecycleEventAppendInput = Omit<
  ConversationThreadLifecycleEventCreateInput,
  'actorType' | 'metadata'
> & {
  actorType?: ConversationThreadLifecycleActorType;
  metadata?: ConversationThreadLifecycleEventMetadataInput | null;
};

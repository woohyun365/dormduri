import type { Prisma } from '../../generated/prisma/client.js';
import type { ConversationRetainedBodyOwnerOptions } from '../../chat/retention/conversation-retained-body.service.js';

export const retentionReviewJobSelect = {
  id: true,
  target: true,
  sourceId: true,
  attemptCount: true,
  maxAttempts: true,
  payload: true,
  manualReviewRequired: true,
} as const;

export const DEFAULT_RETENTION_REVIEW_JOB_CLAIM_BATCH_SIZE = 50;
export const MAX_RETENTION_REVIEW_JOB_CLAIM_BATCH_SIZE = 100;
export const DEFAULT_RETENTION_REVIEW_JOB_CLAIM_LEASE_MS = 5 * 60 * 1000;

export type RetentionReviewJobWorkItem = Prisma.RetentionReviewJobGetPayload<{
  select: typeof retentionReviewJobSelect;
}>;

export interface RetentionReviewJobSweepResult {
  processedCount: number;
  succeededCount: number;
  retryScheduledCount: number;
  manualReviewCount: number;
  reviewedCount: number;
  minimizedCount: number;
}

export interface RetentionReviewJobOwnerOptions {
  conversationRetention?: ConversationRetainedBodyOwnerOptions;
}

export interface RetentionReviewJobClaimOptions {
  batchSize?: number;
  claimLeaseMs?: number;
}

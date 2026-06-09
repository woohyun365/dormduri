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

import type { Prisma } from '../../generated/prisma/client.js';
import type { ArchiveJobTarget } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { createConversationRetainedBodyOwner } from '../conversation-retained-body-owner.js';
import type { ConversationRetainedBodyOwnerOptions } from '../conversation-retained-body-owner.js';
import type { RetainedVaultOwnerOptions } from '../vault/retained-vault.service.js';

export const DEFAULT_ARCHIVE_JOB_MAX_ATTEMPTS = 5;
export const CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS = 365 * 2;

export const deletionArchiveJobTargets = [
  'SEASON_PROFILE_HISTORY',
  'MATCH_HISTORY',
  'THREAD_RETENTION',
  'NICKNAME_AUDIT',
  'ACADEMIC_IDENTITY_AUDIT',
] satisfies ArchiveJobTarget[];

export const archiveJobWorkItemSelect = {
  id: true,
  target: true,
  status: true,
  retainedIdentityId: true,
  userId: true,
  seasonId: true,
  participantId: true,
  matchHistoryEntryId: true,
  threadId: true,
  attemptCount: true,
  maxAttempts: true,
  nextRunAt: true,
  lastErrorCode: true,
  manualReviewRequired: true,
  payload: true,
} as const;

export type ArchiveJobWorkItem = Prisma.ArchiveJobGetPayload<{
  select: typeof archiveJobWorkItemSelect;
}>;

export interface ArchiveStorageResult {
  ok: boolean;
  errorCode?: string;
  waitingCondition?: boolean;
}

export interface ArchiveJobOwnerOptions {
  conversationRetention?: ConversationRetainedBodyOwnerOptions;
  retainedVault?: RetainedVaultOwnerOptions;
}

export interface DeletionArchiveJobInput {
  retainedIdentityId: string;
  userId: string;
  deletedAt: Date;
}

export interface ArchiveJobSweepResult {
  processedCount: number;
  succeededCount: number;
  retryScheduledCount: number;
  manualReviewCount: number;
  waitingConditionCount: number;
}

export interface ArchiveJobActivationResult {
  activatedCount: number;
}

export interface ArchiveDeletionJobHandlerContext {
  prisma: PrismaService;
  job: ArchiveJobWorkItem;
  now: Date;
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>;
  retainedVaultOptions: RetainedVaultOwnerOptions;
}

export type ArchiveDeletionJobHandler = (
  context: ArchiveDeletionJobHandlerContext,
) => Promise<ArchiveStorageResult>;

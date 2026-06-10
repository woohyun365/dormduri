import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  createConversationRetainedBodyOwner,
  type ConversationRetainedBodyOwnerOptions,
} from '../../chat/retention/conversation-retained-body.service.js';
import type { RetainedVaultOwnerOptions } from '../vault/retained-vault.service.js';
import {
  activateWaitingArchiveJobs,
  claimDueDeletionArchiveJobs,
  findArchivedConversationThreads,
  findWaitingThreadRetentionArchiveJobs,
  updateArchiveJob,
} from './archive-job.repository.js';
import {
  markArchiveJobForManualReview,
  resolveNextArchiveRetryAt,
  shouldMarkArchiveJobForManualReview,
} from './archive-job-transition.policy.js';
import {
  type ArchiveJobActivationResult,
  type ArchiveJobClaimOptions,
  type ArchiveJobSweepResult,
} from './archive-job.types.js';
import { archiveDeletionJob } from './targets/archive-target-handlers.js';

export async function activateThreadRetentionJobsForArchivedThreads(
  prisma: Pick<PrismaService, 'archiveJob' | 'conversationThread'>,
  now: Date,
): Promise<ArchiveJobActivationResult> {
  const waitingJobs = await findWaitingThreadRetentionArchiveJobs(prisma);

  const threadIds = [
    ...new Set(waitingJobs.flatMap((job) => (job.threadId ? [job.threadId] : []))),
  ];
  if (threadIds.length === 0) {
    return { activatedCount: 0 };
  }

  const archivedThreads = await findArchivedConversationThreads(prisma, threadIds);
  const archivedThreadIds = new Set(archivedThreads.map((thread) => thread.id));
  const activatedJobIds = waitingJobs
    .filter((job) => job.threadId && archivedThreadIds.has(job.threadId))
    .map((job) => job.id);

  if (activatedJobIds.length === 0) {
    return { activatedCount: 0 };
  }

  const result = await activateWaitingArchiveJobs(prisma, { ids: activatedJobIds, now });

  return { activatedCount: result.count };
}

export async function retryDueArchiveJobs(
  prisma: PrismaService,
  now: Date,
  conversationRetentionOptions: ConversationRetainedBodyOwnerOptions = {},
  retainedVaultOptions: RetainedVaultOwnerOptions = {},
  claimOptions: ArchiveJobClaimOptions = {},
): Promise<ArchiveJobSweepResult> {
  const dueJobs = await claimDueDeletionArchiveJobs(prisma, now, claimOptions);

  const result: ArchiveJobSweepResult = {
    processedCount: 0,
    succeededCount: 0,
    retryScheduledCount: 0,
    manualReviewCount: 0,
    waitingConditionCount: 0,
  };
  const conversationRetention = createConversationRetainedBodyOwner(conversationRetentionOptions);

  for (const job of dueJobs) {
    result.processedCount += 1;

    if (job.manualReviewRequired) {
      await markArchiveJobForManualReview(prisma, job, now, 'MANUAL_REVIEW_REQUIRED');
      result.manualReviewCount += 1;
      continue;
    }

    const archiveResult = await archiveDeletionJob(
      prisma,
      job,
      now,
      conversationRetention,
      retainedVaultOptions,
    );

    if (archiveResult.waitingCondition) {
      await updateArchiveJob(prisma, {
        where: { id: job.id },
        data: {
          status: 'WAITING_CONDITION',
          nextRunAt: now,
          lastErrorCode: archiveResult.errorCode ?? 'WAITING_CONDITION',
          manualReviewRequired: false,
        },
      });
      result.waitingConditionCount += 1;
      continue;
    }

    const attemptCount = job.attemptCount + 1;
    if (archiveResult.ok) {
      await updateArchiveJob(prisma, {
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          attemptCount,
          lastAttemptAt: now,
          lastSucceededAt: now,
          lastErrorCode: null,
          manualReviewRequired: false,
        },
      });
      result.succeededCount += 1;
      continue;
    }

    const lastErrorCode = archiveResult.errorCode ?? 'ARCHIVE_STORAGE_ERROR';
    if (shouldMarkArchiveJobForManualReview({ attemptCount, maxAttempts: job.maxAttempts })) {
      await markArchiveJobForManualReview(prisma, job, now, lastErrorCode, attemptCount);
      result.manualReviewCount += 1;
      continue;
    }

    await updateArchiveJob(prisma, {
      where: { id: job.id },
      data: {
        status: 'RETRY_SCHEDULED',
        attemptCount,
        nextRunAt: resolveNextArchiveRetryAt(now, attemptCount),
        lastAttemptAt: now,
        lastErrorCode,
      },
    });
    result.retryScheduledCount += 1;
  }

  return result;
}

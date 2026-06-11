import type { PrismaService } from '../../platform/database/prisma.service.js';
import { claimRetentionReviewJobs } from '../../generated/prisma/sql.js';
import { disposeDueRetentionAccessLogs } from '../access-logs/retention-access-log-disposal.service.js';
import {
  createConversationRetainedBodyOwner,
  type ConversationRetainedBodyOwnerOptions,
} from '../../chat/retention/conversation-retained-body.service.js';
import {
  calculateRetentionReviewRetryDueAt,
  failedManualReviewStatus,
  normalizeRetentionReviewErrorCode,
  shouldMarkRetentionReviewForManualReview,
} from './retention-review-job-transition.policy.js';
import {
  DEFAULT_RETENTION_REVIEW_JOB_CLAIM_BATCH_SIZE,
  DEFAULT_RETENTION_REVIEW_JOB_CLAIM_LEASE_MS,
  MAX_RETENTION_REVIEW_JOB_CLAIM_BATCH_SIZE,
  type RetentionReviewJobClaimOptions,
  type RetentionReviewJobOwnerOptions,
  type RetentionReviewJobSweepResult,
  type RetentionReviewJobWorkItem,
} from './retention-review-job.types.js';

type TypedQueryable = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
};

export async function retryDueRetentionReviewJobs(
  prisma: PrismaService,
  now: Date,
  options: RetentionReviewJobOwnerOptions = {},
  claimOptions: RetentionReviewJobClaimOptions = {},
): Promise<RetentionReviewJobSweepResult> {
  const dueJobs = await claimDueRetentionReviewJobs(prisma, now, claimOptions);

  const result: RetentionReviewJobSweepResult = {
    processedCount: 0,
    succeededCount: 0,
    retryScheduledCount: 0,
    manualReviewCount: 0,
    reviewedCount: 0,
    minimizedCount: 0,
  };
  const conversationRetention = createConversationRetainedBodyOwner(options.conversationRetention);

  for (const job of dueJobs) {
    result.processedCount += 1;
    if (job.manualReviewRequired) {
      await markReviewJobForManualReview(prisma, job, now, 'MANUAL_REVIEW_REQUIRED');
      result.manualReviewCount += 1;
      continue;
    }

    const reviewResult = await runRetentionReviewJob(prisma, job, now, conversationRetention);
    if (reviewResult.ok) {
      await prisma.retentionReviewJob.update({
        where: { id: job.id },
        data: {
          status: reviewResult.rescheduleAt ? 'PENDING' : 'SUCCEEDED',
          dueAt: reviewResult.rescheduleAt ?? undefined,
          attemptCount: job.attemptCount + 1,
          lastAttemptAt: now,
          lastSucceededAt: now,
          lastErrorCode: null,
          manualReviewRequired: false,
        },
      });
      result.succeededCount += 1;
      result.reviewedCount += reviewResult.reviewedCount ?? 0;
      result.minimizedCount += reviewResult.minimizedCount ?? 0;
      continue;
    }

    const attemptCount = job.attemptCount + 1;
    if (shouldMarkRetentionReviewForManualReview({ attemptCount, maxAttempts: job.maxAttempts })) {
      await markReviewJobForManualReview(
        prisma,
        job,
        now,
        reviewResult.errorCode ?? 'RETENTION_REVIEW_ERROR',
        attemptCount,
      );
      result.manualReviewCount += 1;
      continue;
    }

    await prisma.retentionReviewJob.update({
      where: { id: job.id },
      data: {
        status: 'RETRY_SCHEDULED',
        attemptCount,
        dueAt: calculateRetentionReviewRetryDueAt(now, attemptCount),
        lastAttemptAt: now,
        lastErrorCode: reviewResult.errorCode ?? 'RETENTION_REVIEW_ERROR',
      },
    });
    result.retryScheduledCount += 1;
  }

  return result;
}

export function clampRetentionReviewJobClaimBatchSize(batchSize?: number) {
  const requested = batchSize ?? DEFAULT_RETENTION_REVIEW_JOB_CLAIM_BATCH_SIZE;
  return Math.max(1, Math.min(requested, MAX_RETENTION_REVIEW_JOB_CLAIM_BATCH_SIZE));
}

export function resolveRetentionReviewJobClaimLeaseUntil(now: Date, claimLeaseMs?: number) {
  return new Date(now.getTime() + (claimLeaseMs ?? DEFAULT_RETENTION_REVIEW_JOB_CLAIM_LEASE_MS));
}

export async function claimDueRetentionReviewJobs(
  prisma: TypedQueryable,
  now: Date,
  options: RetentionReviewJobClaimOptions = {},
): Promise<RetentionReviewJobWorkItem[]> {
  const safeBatchSize = clampRetentionReviewJobClaimBatchSize(options.batchSize);
  const leaseUntil = resolveRetentionReviewJobClaimLeaseUntil(now, options.claimLeaseMs);

  return prisma.$queryRawTyped<claimRetentionReviewJobs.Result>(
    claimRetentionReviewJobs(now, leaseUntil, safeBatchSize),
  );
}

async function runRetentionReviewJob(
  prisma: PrismaService,
  job: RetentionReviewJobWorkItem,
  now: Date,
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>,
) {
  try {
    switch (job.target) {
      case 'CHAT_IDENTITY_LINK': {
        const review = await prisma.runSerializableTransaction((tx) =>
          conversationRetention.reviewRetainedConversationIdentityLinksTx(tx, {
            threadId: job.sourceId,
            now,
            metadata: {
              retentionReviewJobId: job.id,
              retentionReviewJobTarget: job.target,
            },
          }),
        );
        return {
          ok: true,
          reviewedCount: review.scannedCount,
          minimizedCount: review.minimizedCount,
          rescheduleAt: review.nextReviewAt,
        };
      }
      case 'ACCESS_LOG_DISPOSAL': {
        const disposal = await disposeDueRetentionAccessLogs(prisma, now);
        return {
          ok: true,
          reviewedCount: disposal.processedCount,
          minimizedCount: disposal.processedCount,
          rescheduleAt: disposal.nextDueAt,
        };
      }
      default:
        return { ok: false, errorCode: 'RETENTION_REVIEW_HANDLER_MISSING' };
    }
  } catch (error) {
    return {
      ok: false,
      errorCode:
        error instanceof Error
          ? normalizeRetentionReviewErrorCode(error.message)
          : 'RETENTION_REVIEW_ERROR',
    };
  }
}

async function markReviewJobForManualReview(
  prisma: Pick<PrismaService, 'retentionReviewJob'>,
  job: Pick<RetentionReviewJobWorkItem, 'id' | 'attemptCount'>,
  now: Date,
  errorCode: string,
  attemptCount: number = job.attemptCount,
) {
  await prisma.retentionReviewJob.update({
    where: { id: job.id },
    data: {
      status: failedManualReviewStatus(),
      attemptCount,
      lastAttemptAt: now,
      lastErrorCode: errorCode,
      manualReviewRequired: true,
    },
  });
}

export type { ConversationRetainedBodyOwnerOptions };

import type { Prisma } from '../generated/prisma/client.js';
import type { ArchiveJobStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../platform/database/prisma.service.js';
import {
  createConversationRetainedBodyOwner,
  type ConversationRetainedBodyOwnerOptions,
} from './conversation-retained-body-owner.js';
import { disposeDueRetentionAccessLogs } from './retention-access-log-owner.js';

const RETRY_BASE_DELAY_MS = 60 * 60 * 1_000;

const retentionReviewJobSelect = {
  id: true,
  target: true,
  sourceId: true,
  attemptCount: true,
  maxAttempts: true,
  payload: true,
  manualReviewRequired: true,
} as const;

type RetentionReviewJobWorkItem = Prisma.RetentionReviewJobGetPayload<{
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

export function createRetentionReviewJobOwner(
  prisma: PrismaService,
  options: RetentionReviewJobOwnerOptions = {},
) {
  return {
    retryDueRetentionReviewJobs(now: Date): Promise<RetentionReviewJobSweepResult> {
      return retryDueRetentionReviewJobs(prisma, now, options);
    },
  };
}

export async function scheduleChatIdentityLinkReviewJobTx(
  tx: Prisma.TransactionClient,
  input: {
    threadId: string;
    dueAt: Date;
    archiveJobId: string;
    retainedIdentityId?: string | null;
    userId?: string | null;
  },
) {
  await tx.retentionReviewJob.upsert({
    where: {
      target_sourceId: {
        target: 'CHAT_IDENTITY_LINK',
        sourceId: input.threadId,
      },
    },
    update: {
      status: 'PENDING',
      dueAt: input.dueAt,
      lastErrorCode: null,
      manualReviewRequired: false,
      payload: buildChatIdentityLinkReviewPayload(input) as Prisma.InputJsonValue,
    },
    create: {
      target: 'CHAT_IDENTITY_LINK',
      sourceId: input.threadId,
      dueAt: input.dueAt,
      payload: buildChatIdentityLinkReviewPayload(input) as Prisma.InputJsonValue,
    },
  });
}

export async function retryDueRetentionReviewJobs(
  prisma: PrismaService,
  now: Date,
  options: RetentionReviewJobOwnerOptions = {},
): Promise<RetentionReviewJobSweepResult> {
  const dueJobs = await prisma.retentionReviewJob.findMany({
    where: {
      status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
      dueAt: { lte: now },
    },
    select: retentionReviewJobSelect,
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

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
    if (attemptCount >= job.maxAttempts) {
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
        dueAt: new Date(now.getTime() + RETRY_BASE_DELAY_MS * Math.max(1, attemptCount)),
        lastAttemptAt: now,
        lastErrorCode: reviewResult.errorCode ?? 'RETENTION_REVIEW_ERROR',
      },
    });
    result.retryScheduledCount += 1;
  }

  return result;
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
      status: 'FAILED_MANUAL_REVIEW' satisfies ArchiveJobStatus,
      attemptCount,
      lastAttemptAt: now,
      lastErrorCode: errorCode,
      manualReviewRequired: true,
    },
  });
}

function buildChatIdentityLinkReviewPayload(input: {
  archiveJobId: string;
  retainedIdentityId?: string | null;
  userId?: string | null;
}) {
  return {
    schemaVersion: 1,
    source: 'THREAD_RETENTION',
    archiveJobId: input.archiveJobId,
    retainedIdentityId: input.retainedIdentityId ?? undefined,
    userId: input.userId ?? undefined,
  };
}

function normalizeRetentionReviewErrorCode(message: string) {
  return (
    message
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/[^A-Z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80) || 'RETENTION_REVIEW_ERROR'
  );
}

import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { resolveChatIdentityReviewAfter } from '../../retention/archive-jobs/archive-job.payload.js';
import { normalizeArchiveErrorCode } from '../../retention/archive-jobs/archive-job-transition.policy.js';
import type {
  ArchiveJobWorkItem,
  ArchiveStorageResult,
} from '../../retention/archive-jobs/archive-job.types.js';
import { scheduleChatIdentityLinkReviewJobTx } from '../../retention/review-jobs/schedule-chat-identity-link-review-job.command.js';
import type { createConversationRetainedBodyOwner } from './conversation-retained-body.service.js';

export async function archiveThreadRetentionJob(
  prisma: PrismaService,
  job: ArchiveJobWorkItem,
  now: Date,
  conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>,
): Promise<ArchiveStorageResult> {
  if (!job.threadId) {
    return { ok: false, errorCode: 'THREAD_RETENTION_THREAD_ID_MISSING' };
  }

  const thread = await prisma.conversationThread.findUnique({
    where: { id: job.threadId },
    select: { id: true, status: true },
  });

  if (!thread) {
    return { ok: false, errorCode: 'THREAD_NOT_FOUND' };
  }

  if (thread.status !== 'ARCHIVED') {
    return { ok: false, waitingCondition: true, errorCode: 'THREAD_NOT_ARCHIVED' };
  }

  try {
    await prisma.runSerializableTransaction((tx) =>
      archiveThreadRetentionJobTx(tx, {
        job,
        threadId: thread.id,
        now,
        conversationRetention,
      }),
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode:
        error instanceof Error
          ? normalizeArchiveErrorCode(error.message)
          : 'THREAD_RETENTION_ARCHIVE_ERROR',
    };
  }
}

async function archiveThreadRetentionJobTx(
  tx: Prisma.TransactionClient,
  input: {
    job: ArchiveJobWorkItem;
    threadId: string;
    now: Date;
    conversationRetention: ReturnType<typeof createConversationRetainedBodyOwner>;
  },
) {
  const { job, threadId, now, conversationRetention } = input;
  await conversationRetention.retainAndTombstoneThreadMessagesTx(tx, {
    threadId,
    archiveJobId: job.id,
    triggerUserId: job.userId,
    triggerRetainedIdentityId: job.retainedIdentityId,
    now,
    metadata: {
      archiveJobId: job.id,
      archiveJobTarget: job.target,
    },
  });
  await scheduleChatIdentityLinkReviewJobTx(tx, {
    threadId,
    dueAt: resolveChatIdentityReviewAfter(job.payload, now),
    archiveJobId: job.id,
    retainedIdentityId: job.retainedIdentityId,
    userId: job.userId,
  });
}

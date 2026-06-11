import type { Prisma } from '../../generated/prisma/client.js';
import { claimRetentionArchiveJobs } from '../../generated/prisma/sql.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  DEFAULT_ARCHIVE_JOB_CLAIM_BATCH_SIZE,
  DEFAULT_ARCHIVE_JOB_CLAIM_LEASE_MS,
  MAX_ARCHIVE_JOB_CLAIM_BATCH_SIZE,
  type ArchiveJobClaimOptions,
  type ArchiveJobWorkItem,
} from './archive-job.types.js';

type TypedQueryable = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
};

export function clampArchiveJobClaimBatchSize(batchSize?: number) {
  const requested = batchSize ?? DEFAULT_ARCHIVE_JOB_CLAIM_BATCH_SIZE;
  return Math.max(1, Math.min(requested, MAX_ARCHIVE_JOB_CLAIM_BATCH_SIZE));
}

export function resolveArchiveJobClaimLeaseUntil(now: Date, claimLeaseMs?: number) {
  return new Date(now.getTime() + (claimLeaseMs ?? DEFAULT_ARCHIVE_JOB_CLAIM_LEASE_MS));
}

export async function claimDueDeletionArchiveJobs(
  prisma: TypedQueryable,
  now: Date,
  options: ArchiveJobClaimOptions = {},
): Promise<ArchiveJobWorkItem[]> {
  const safeBatchSize = clampArchiveJobClaimBatchSize(options.batchSize);
  const leaseUntil = resolveArchiveJobClaimLeaseUntil(now, options.claimLeaseMs);

  return prisma.$queryRawTyped<claimRetentionArchiveJobs.Result>(
    claimRetentionArchiveJobs(now, leaseUntil, safeBatchSize),
  );
}

export function updateArchiveJob(
  prisma: Pick<PrismaService, 'archiveJob'>,
  input: Parameters<PrismaService['archiveJob']['update']>[0],
) {
  return prisma.archiveJob.update(input);
}

export function findWaitingThreadRetentionArchiveJobs(prisma: Pick<PrismaService, 'archiveJob'>) {
  return prisma.archiveJob.findMany({
    where: {
      target: 'THREAD_RETENTION',
      status: 'WAITING_CONDITION',
      threadId: { not: null },
    },
    select: { id: true, threadId: true },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
}

export function findArchivedConversationThreads(
  prisma: Pick<PrismaService, 'conversationThread'>,
  threadIds: string[],
) {
  return prisma.conversationThread.findMany({
    where: { id: { in: threadIds }, status: 'ARCHIVED' },
    select: { id: true },
  });
}

export function activateWaitingArchiveJobs(
  prisma: Pick<PrismaService, 'archiveJob'>,
  input: { ids: string[]; now: Date },
) {
  return prisma.archiveJob.updateMany({
    where: { id: { in: input.ids } },
    data: {
      status: 'PENDING',
      nextRunAt: input.now,
      lastErrorCode: null,
      manualReviewRequired: false,
    },
  });
}

export type ArchiveJobUpdateInput = Prisma.ArchiveJobUpdateArgs;

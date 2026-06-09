import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { archiveJobWorkItemSelect, deletionArchiveJobTargets } from './archive-job.types.js';

export function findDueDeletionArchiveJobs(prisma: PrismaService, now: Date) {
  return prisma.archiveJob.findMany({
    where: {
      target: { in: deletionArchiveJobTargets },
      status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
      nextRunAt: { lte: now },
    },
    select: archiveJobWorkItemSelect,
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
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

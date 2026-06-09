import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  activateThreadRetentionJobsForArchivedThreads,
  retryDueArchiveJobs,
} from './archive-job-runner.service.js';
import type {
  ArchiveJobActivationResult,
  ArchiveJobOwnerOptions,
  ArchiveJobSweepResult,
} from './archive-job.types.js';

export function createArchiveJobOwner(prisma: PrismaService, options: ArchiveJobOwnerOptions = {}) {
  return {
    async retryDueArchiveJobs(now: Date): Promise<ArchiveJobSweepResult> {
      return retryDueArchiveJobs(prisma, now, options.conversationRetention, options.retainedVault);
    },
    async activateThreadRetentionJobsForArchivedThreads(
      now: Date,
    ): Promise<ArchiveJobActivationResult> {
      return activateThreadRetentionJobsForArchivedThreads(prisma, now);
    },
  };
}

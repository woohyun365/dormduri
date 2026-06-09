import type { PrismaService } from '../../platform/database/prisma.service.js';
import { retryDueRetentionReviewJobs } from './retention-review-job-runner.service.js';
import type {
  RetentionReviewJobOwnerOptions,
  RetentionReviewJobSweepResult,
} from './retention-review-job.types.js';

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

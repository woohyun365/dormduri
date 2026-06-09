import { Injectable } from '@nestjs/common';
import { RetentionWorkerPrismaService } from '../../platform/database/prisma.service.js';
import {
  activateThreadRetentionJobsForArchivedThreads,
  retryDueArchiveJobs,
} from '../../retention/archive-jobs/archive-job-runner.service.js';
import { disposeExpiredRetainedIdentities } from '../../retention/retained-identities/retained-identity-disposal.service.js';
import { disposeDueRetentionAccessLogs } from '../../retention/access-logs/retention-access-log-disposal.service.js';
import { retryDueRetentionReviewJobs } from '../../retention/review-jobs/retention-review-job-runner.service.js';
import type { UserRetentionSweepPort } from '../application/ports/user-retention-sweep.port.js';

@Injectable()
export class UserRetentionSweepService implements UserRetentionSweepPort {
  constructor(private readonly retentionWorkerPrisma: RetentionWorkerPrismaService) {}

  activateThreadRetentionJobsForArchivedThreads(now: Date) {
    return activateThreadRetentionJobsForArchivedThreads(this.retentionWorkerPrisma, now);
  }

  retryDueDeletionArchiveJobs(now: Date) {
    return retryDueArchiveJobs(this.retentionWorkerPrisma, now);
  }

  disposeExpiredRetainedIdentities(now: Date) {
    return disposeExpiredRetainedIdentities(this.retentionWorkerPrisma, now);
  }

  retryDueRetentionReviewJobs(now: Date) {
    return retryDueRetentionReviewJobs(this.retentionWorkerPrisma, now);
  }

  disposeDueRetentionAccessLogs(now: Date) {
    return disposeDueRetentionAccessLogs(this.retentionWorkerPrisma, now);
  }
}

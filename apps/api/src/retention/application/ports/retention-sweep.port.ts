import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../../archive-jobs/archive-job.types.js';
import type { RetentionAccessLogDisposalResult } from '../../access-logs/retention-access-log.types.js';
import type { RetainedIdentityDisposalResult } from '../../retained-identities/retained-identity.types.js';
import type { RetentionReviewJobSweepResult } from '../../review-jobs/retention-review-job.types.js';

export const RETENTION_SWEEP_PORT = Symbol('RETENTION_SWEEP_PORT');

export interface RetentionSweepPort {
  activateThreadRetentionJobsForArchivedThreads(now: Date): Promise<ArchiveJobActivationResult>;
  retryDueDeletionArchiveJobs(now: Date): Promise<ArchiveJobSweepResult>;
  disposeExpiredRetainedIdentities(now: Date): Promise<RetainedIdentityDisposalResult>;
  retryDueRetentionReviewJobs(now: Date): Promise<RetentionReviewJobSweepResult>;
  disposeDueRetentionAccessLogs(now: Date): Promise<RetentionAccessLogDisposalResult>;
}

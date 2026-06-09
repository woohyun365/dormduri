import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../../../retention/archive-job-owner.js';
import type { RetainedIdentityDisposalResult } from '../../../retention/retained-identities/retained-identity.types.js';
import type { RetentionAccessLogDisposalResult } from '../../../retention/access-logs/retention-access-log.types.js';
import type { RetentionReviewJobSweepResult } from '../../../retention/review-jobs/retention-review-job.types.js';

export const USER_RETENTION_SWEEP_PORT = Symbol('USER_RETENTION_SWEEP_PORT');

export interface UserRetentionSweepPort {
  activateThreadRetentionJobsForArchivedThreads(now: Date): Promise<ArchiveJobActivationResult>;
  retryDueDeletionArchiveJobs(now: Date): Promise<ArchiveJobSweepResult>;
  disposeExpiredRetainedIdentities(now: Date): Promise<RetainedIdentityDisposalResult>;
  retryDueRetentionReviewJobs(now: Date): Promise<RetentionReviewJobSweepResult>;
  disposeDueRetentionAccessLogs(now: Date): Promise<RetentionAccessLogDisposalResult>;
}

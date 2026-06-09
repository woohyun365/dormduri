import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../../../retention/archive-job-owner.js';
import type { RetainedIdentityDisposalResult } from '../../../retention/retained-identity-owner.js';
import type { RetentionAccessLogDisposalResult } from '../../../retention/retention-access-log-owner.js';
import type { RetentionReviewJobSweepResult } from '../../../retention/retention-review-job-owner.js';

export const USER_RETENTION_SWEEP_PORT = Symbol('USER_RETENTION_SWEEP_PORT');

export interface UserRetentionSweepPort {
  activateThreadRetentionJobsForArchivedThreads(now: Date): Promise<ArchiveJobActivationResult>;
  retryDueDeletionArchiveJobs(now: Date): Promise<ArchiveJobSweepResult>;
  disposeExpiredRetainedIdentities(now: Date): Promise<RetainedIdentityDisposalResult>;
  retryDueRetentionReviewJobs(now: Date): Promise<RetentionReviewJobSweepResult>;
  disposeDueRetentionAccessLogs(now: Date): Promise<RetentionAccessLogDisposalResult>;
}

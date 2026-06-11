import type { AuthOperationalCleanupResult } from '../auth/operations/auth-operational-cleanup.service.js';
import type { ChatLifecycleSweepResult } from '../chat/application/ports/chat-lifecycle-sweep.port.js';
import type { MatchHistoryMaterializationResult } from '../matches/application/ports/match-history-materialization.port.js';
import type { BookmarkExpirationSweepResult } from '../social-safety/bookmarks/application/bookmark-lifecycle.service.js';
import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../retention/archive-jobs/archive-job.types.js';
import type { RetentionAccessLogDisposalResult } from '../retention/access-logs/retention-access-log.types.js';
import type { RetentionReviewJobSweepResult } from '../retention/review-jobs/retention-review-job.types.js';
import type { RetainedIdentityDisposalResult } from '../retention/retained-identities/retained-identity.types.js';
import type { SeasonParticipantBackfillResult } from '../season-participants/participants/season-participant-records.js';

interface MatchLifecycleTransitionSweepResult {
  expiredRequests: number;
  expiredUnmatchRequests: number;
  seasonEndedActiveMatches: number;
}

export interface LifecycleSweepResult {
  ranAt: string;
  matchTransitions: MatchLifecycleTransitionSweepResult;
  threadTransitions: ChatLifecycleSweepResult;
  matchHistory: MatchHistoryMaterializationResult;
  participantBackfill: SeasonParticipantBackfillResult[];
  socialSafetyBookmarkCleanupSweep: BookmarkExpirationSweepResult;
  threadRetentionActivationSweep: ArchiveJobActivationResult;
  archiveJobSweep: ArchiveJobSweepResult;
  retainedIdentityDisposalSweep: RetainedIdentityDisposalResult;
  retentionReviewJobSweep: RetentionReviewJobSweepResult;
  retentionAccessLogDisposalSweep: RetentionAccessLogDisposalResult;
  authCleanupSweep: AuthOperationalCleanupResult;
}

export type LifecycleSweepTaskResults = Omit<LifecycleSweepResult, 'ranAt'>;
export type LifecycleSweepTaskName = keyof LifecycleSweepTaskResults;

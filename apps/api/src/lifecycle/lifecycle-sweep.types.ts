import type { AuthOperationalCleanupResult } from '../auth/operations/auth-operational-cleanup.service.js';
import type { ChatLifecycleSweepResult } from '../chat/application/ports/chat-lifecycle-sweep.port.js';
import type { MatchHistoryMaterializationResult } from '../matches/match-history-materialization-owner.js';
import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../retention/archive-job-owner.js';
import type { RetentionAccessLogDisposalResult } from '../retention/retention-access-log-owner.js';
import type { RetentionReviewJobSweepResult } from '../retention/retention-review-job-owner.js';
import type { RetainedIdentityDisposalResult } from '../retention/retained-identity-owner.js';
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
  threadRetentionActivationSweep: ArchiveJobActivationResult;
  archiveJobSweep: ArchiveJobSweepResult;
  retainedIdentityDisposalSweep: RetainedIdentityDisposalResult;
  retentionReviewJobSweep: RetentionReviewJobSweepResult;
  retentionAccessLogDisposalSweep: RetentionAccessLogDisposalResult;
  authCleanupSweep: AuthOperationalCleanupResult;
}

export type LifecycleSweepTaskResults = Omit<LifecycleSweepResult, 'ranAt'>;
export type LifecycleSweepTaskName = keyof LifecycleSweepTaskResults;

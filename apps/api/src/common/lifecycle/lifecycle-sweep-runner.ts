import type { ChatService } from '../../chat/chat.service.js';
import type { MatchesService } from '../../matches/matches.service.js';
import type { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import type { UsersService } from '../../users/users.service.js';
import type { ManagedPrismaClient, PrismaService } from '../prisma/prisma.service.js';
import type { RetentionObservabilityService } from '../../retention/retention-observability.js';
import type { LifecycleSweepResult } from './lifecycle-sweep.service.js';

interface LifecycleSweepRunnerDeps {
  prisma: PrismaService;
  retentionPrisma: ManagedPrismaClient;
  retentionObservability?: Pick<RetentionObservabilityService, 'emitSweep'>;
  chatService: Pick<ChatService, 'sweepThreadLifecycle'>;
  matchesService: Pick<MatchesService, 'sweepHistoryMaterialization' | 'sweepLifecycleTransitions'>;
  seasonParticipantsService: Pick<SeasonParticipantsService, 'backfillCurrentSeasonParticipants'>;
  usersService: Pick<
    UsersService,
    | 'activateThreadRetentionJobsForArchivedThreads'
    | 'retryDueDeletionArchiveJobs'
    | 'disposeExpiredRetainedIdentities'
    | 'retryDueRetentionReviewJobs'
    | 'disposeDueRetentionAccessLogs'
  >;
}

export function createLifecycleSweepRunner(deps: LifecycleSweepRunnerDeps) {
  async function runSweep(now?: Date): Promise<LifecycleSweepResult> {
    const startedAt = Date.now();
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const matchTransitions = await deps.matchesService.sweepLifecycleTransitions(referenceNow);
    const threadTransitions = await deps.chatService.sweepThreadLifecycle(referenceNow);
    const matchHistory = await deps.matchesService.sweepHistoryMaterialization(referenceNow);
    const participantBackfill =
      await deps.seasonParticipantsService.backfillCurrentSeasonParticipants(referenceNow);
    const threadRetentionActivationSweep =
      await deps.usersService.activateThreadRetentionJobsForArchivedThreads(referenceNow);
    const archiveJobSweep = await deps.usersService.retryDueDeletionArchiveJobs(referenceNow);
    const retainedIdentityDisposalSweep =
      await deps.usersService.disposeExpiredRetainedIdentities(referenceNow);
    const retentionReviewJobSweep =
      await deps.usersService.retryDueRetentionReviewJobs(referenceNow);
    const retentionAccessLogDisposalSweep =
      await deps.usersService.disposeDueRetentionAccessLogs(referenceNow);

    const result = {
      ranAt: referenceNow.toISOString(),
      matchTransitions,
      threadTransitions,
      matchHistory,
      participantBackfill,
      threadRetentionActivationSweep,
      archiveJobSweep,
      retainedIdentityDisposalSweep,
      retentionReviewJobSweep,
      retentionAccessLogDisposalSweep,
    } satisfies LifecycleSweepResult;

    try {
      await deps.retentionObservability?.emitSweep({
        prisma: deps.retentionPrisma,
        result,
        now: referenceNow,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      // Observability emission must never prevent lifecycle state convergence.
      console.error(
        '[LifecycleSweepRunner] retention observability emission failed',
        error instanceof Error ? error.stack : error,
      );
    }

    return result;
  }

  async function runPeriodicSweep(now?: Date): Promise<LifecycleSweepResult> {
    return runSweep(now);
  }

  async function runBoundarySweep(now?: Date): Promise<LifecycleSweepResult> {
    return runSweep(now);
  }

  return {
    runSweep,
    runPeriodicSweep,
    runBoundarySweep,
  };
}

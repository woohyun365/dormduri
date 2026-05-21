import type { ChatService } from '../../chat/chat.service.js';
import type { MatchesService } from '../../matches/matches.service.js';
import type { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import type { UsersService } from '../../users/users.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { LifecycleSweepResult } from './lifecycle-sweep.service.js';

interface LifecycleSweepRunnerDeps {
  prisma: PrismaService;
  chatService: Pick<ChatService, 'sweepThreadLifecycle'>;
  matchesService: Pick<MatchesService, 'sweepHistoryMaterialization' | 'sweepLifecycleTransitions'>;
  seasonParticipantsService: Pick<SeasonParticipantsService, 'backfillCurrentSeasonParticipants'>;
  usersService: Pick<
    UsersService,
    | 'activateThreadRetentionJobsForArchivedThreads'
    | 'retryDueDeletionArchiveJobs'
    | 'disposeExpiredRetainedIdentities'
  >;
}

export function createLifecycleSweepRunner(deps: LifecycleSweepRunnerDeps) {
  async function runSweep(now?: Date): Promise<LifecycleSweepResult> {
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

    return {
      ranAt: referenceNow.toISOString(),
      matchTransitions,
      threadTransitions,
      matchHistory,
      participantBackfill,
      threadRetentionActivationSweep,
      archiveJobSweep,
      retainedIdentityDisposalSweep,
    };
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

import {
  ArchiveJobRetrySweepTask,
  AuthOperationalCleanupSweepTask,
  ChatThreadLifecycleSweepTask,
  LIFECYCLE_SWEEP_TASK_PROVIDERS,
  MatchHistoryMaterializationSweepTask,
  MatchLifecycleTransitionSweepTask,
  RetainedIdentityDisposalSweepTask,
  RetentionAccessLogDisposalSweepTask,
  RetentionReviewJobRetrySweepTask,
  SeasonParticipantBackfillSweepTask,
  ThreadRetentionActivationSweepTask,
} from './lifecycle-sweep-tasks.adapter.js';

describe('lifecycle sweep task adapters', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  it('preserves the canonical sweep provider order', () => {
    expect(LIFECYCLE_SWEEP_TASK_PROVIDERS).toEqual([
      MatchLifecycleTransitionSweepTask,
      ChatThreadLifecycleSweepTask,
      MatchHistoryMaterializationSweepTask,
      SeasonParticipantBackfillSweepTask,
      ThreadRetentionActivationSweepTask,
      ArchiveJobRetrySweepTask,
      RetainedIdentityDisposalSweepTask,
      RetentionReviewJobRetrySweepTask,
      RetentionAccessLogDisposalSweepTask,
      AuthOperationalCleanupSweepTask,
    ]);
  });

  it('adapts each existing domain sweep call behind a named task port', async () => {
    const matchesService = {
      sweepLifecycleTransitions: jest.fn().mockResolvedValue({
        expiredRequests: 1,
        expiredUnmatchRequests: 2,
        seasonEndedActiveMatches: 3,
      }),
      sweepHistoryMaterialization: jest
        .fn()
        .mockResolvedValue({ processedSeasons: 4, rebuiltEntries: 5 }),
    };
    const chatLifecycleSweep = {
      sweepThreadLifecycle: jest.fn().mockResolvedValue({ scannedCount: 6, updatedCount: 7 }),
    };
    const seasonParticipantsService = {
      backfillCurrentSeasonParticipants: jest.fn().mockResolvedValue([
        {
          campus: 'CHUNCHEON',
          seasonId: 'season-1',
          eligibleUserCount: 8,
          createdCount: 9,
          existingCount: 10,
        },
      ]),
    };
    const usersService = {
      activateThreadRetentionJobsForArchivedThreads: jest
        .fn()
        .mockResolvedValue({ activatedCount: 11 }),
      retryDueDeletionArchiveJobs: jest.fn().mockResolvedValue({
        processedCount: 12,
        succeededCount: 13,
        retryScheduledCount: 14,
        manualReviewCount: 15,
        waitingConditionCount: 16,
      }),
      disposeExpiredRetainedIdentities: jest.fn().mockResolvedValue({ processedCount: 17 }),
      retryDueRetentionReviewJobs: jest.fn().mockResolvedValue({
        processedCount: 18,
        succeededCount: 19,
        retryScheduledCount: 20,
        manualReviewCount: 21,
        reviewedCount: 22,
        minimizedCount: 23,
      }),
      disposeDueRetentionAccessLogs: jest.fn().mockResolvedValue({
        processedCount: 24,
        nextDueAt: null,
      }),
    };
    const authOperationalCleanupService = {
      runCleanupBatch: jest.fn().mockResolvedValue({
        expiredSessions: 25,
        verificationCodes: 26,
        verificationRequestLogs: 27,
        loginAttempts: 28,
        securityEvents: 29,
        cleanupLagSeconds: 30,
        ranAt: now.toISOString(),
      }),
    };

    const tasks = [
      new MatchLifecycleTransitionSweepTask(matchesService as never),
      new ChatThreadLifecycleSweepTask(chatLifecycleSweep as never),
      new MatchHistoryMaterializationSweepTask(matchesService as never),
      new SeasonParticipantBackfillSweepTask(seasonParticipantsService as never),
      new ThreadRetentionActivationSweepTask(usersService as never),
      new ArchiveJobRetrySweepTask(usersService as never),
      new RetainedIdentityDisposalSweepTask(usersService as never),
      new RetentionReviewJobRetrySweepTask(usersService as never),
      new RetentionAccessLogDisposalSweepTask(usersService as never),
      new AuthOperationalCleanupSweepTask(authOperationalCleanupService as never),
    ];

    await expect(Promise.all(tasks.map((task) => task.run(now)))).resolves.toEqual([
      { expiredRequests: 1, expiredUnmatchRequests: 2, seasonEndedActiveMatches: 3 },
      { scannedCount: 6, updatedCount: 7 },
      { processedSeasons: 4, rebuiltEntries: 5 },
      [
        {
          campus: 'CHUNCHEON',
          seasonId: 'season-1',
          eligibleUserCount: 8,
          createdCount: 9,
          existingCount: 10,
        },
      ],
      { activatedCount: 11 },
      {
        processedCount: 12,
        succeededCount: 13,
        retryScheduledCount: 14,
        manualReviewCount: 15,
        waitingConditionCount: 16,
      },
      { processedCount: 17 },
      {
        processedCount: 18,
        succeededCount: 19,
        retryScheduledCount: 20,
        manualReviewCount: 21,
        reviewedCount: 22,
        minimizedCount: 23,
      },
      { processedCount: 24, nextDueAt: null },
      {
        expiredSessions: 25,
        verificationCodes: 26,
        verificationRequestLogs: 27,
        loginAttempts: 28,
        securityEvents: 29,
        cleanupLagSeconds: 30,
        ranAt: now.toISOString(),
      },
    ]);
    expect(tasks.map((task) => task.name)).toEqual([
      'matchTransitions',
      'threadTransitions',
      'matchHistory',
      'participantBackfill',
      'threadRetentionActivationSweep',
      'archiveJobSweep',
      'retainedIdentityDisposalSweep',
      'retentionReviewJobSweep',
      'retentionAccessLogDisposalSweep',
      'authCleanupSweep',
    ]);
    expect(tasks.map((task) => task.order)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(matchesService.sweepLifecycleTransitions).toHaveBeenCalledWith(now);
    expect(matchesService.sweepHistoryMaterialization).toHaveBeenCalledWith(now);
    expect(chatLifecycleSweep.sweepThreadLifecycle).toHaveBeenCalledWith(now);
    expect(seasonParticipantsService.backfillCurrentSeasonParticipants).toHaveBeenCalledWith(now);
    expect(usersService.activateThreadRetentionJobsForArchivedThreads).toHaveBeenCalledWith(now);
    expect(usersService.retryDueDeletionArchiveJobs).toHaveBeenCalledWith(now);
    expect(usersService.disposeExpiredRetainedIdentities).toHaveBeenCalledWith(now);
    expect(usersService.retryDueRetentionReviewJobs).toHaveBeenCalledWith(now);
    expect(usersService.disposeDueRetentionAccessLogs).toHaveBeenCalledWith(now);
    expect(authOperationalCleanupService.runCleanupBatch).toHaveBeenCalledWith(now);
  });
});

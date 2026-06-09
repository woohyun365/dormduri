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
  SocialSafetyBookmarkCleanupSweepTask,
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
      SocialSafetyBookmarkCleanupSweepTask,
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
    const bookmarkLifecycleService = {
      expireEndedSeasonBookmarks: jest
        .fn()
        .mockResolvedValue({ scannedCount: 11, expiredCount: 10 }),
    };
    const userRetentionSweep = {
      activateThreadRetentionJobsForArchivedThreads: jest
        .fn()
        .mockResolvedValue({ activatedCount: 12 }),
      retryDueDeletionArchiveJobs: jest.fn().mockResolvedValue({
        processedCount: 13,
        succeededCount: 14,
        retryScheduledCount: 15,
        manualReviewCount: 16,
        waitingConditionCount: 17,
      }),
      disposeExpiredRetainedIdentities: jest.fn().mockResolvedValue({ processedCount: 19 }),
      retryDueRetentionReviewJobs: jest.fn().mockResolvedValue({
        processedCount: 19,
        succeededCount: 20,
        retryScheduledCount: 21,
        manualReviewCount: 22,
        reviewedCount: 23,
        minimizedCount: 24,
      }),
      disposeDueRetentionAccessLogs: jest.fn().mockResolvedValue({
        processedCount: 25,
        nextDueAt: null,
      }),
    };
    const authOperationalCleanupService = {
      runCleanupBatch: jest.fn().mockResolvedValue({
        expiredSessions: 26,
        verificationCodes: 27,
        verificationRequestLogs: 28,
        loginAttempts: 29,
        securityEvents: 30,
        cleanupLagSeconds: 31,
        ranAt: now.toISOString(),
      }),
    };

    const tasks = [
      new MatchLifecycleTransitionSweepTask(matchesService as never),
      new ChatThreadLifecycleSweepTask(chatLifecycleSweep as never),
      new MatchHistoryMaterializationSweepTask(matchesService as never),
      new SeasonParticipantBackfillSweepTask(seasonParticipantsService as never),
      new SocialSafetyBookmarkCleanupSweepTask(bookmarkLifecycleService as never),
      new ThreadRetentionActivationSweepTask(userRetentionSweep as never),
      new ArchiveJobRetrySweepTask(userRetentionSweep as never),
      new RetainedIdentityDisposalSweepTask(userRetentionSweep as never),
      new RetentionReviewJobRetrySweepTask(userRetentionSweep as never),
      new RetentionAccessLogDisposalSweepTask(userRetentionSweep as never),
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
      { scannedCount: 11, expiredCount: 10 },
      { activatedCount: 12 },
      {
        processedCount: 13,
        succeededCount: 14,
        retryScheduledCount: 15,
        manualReviewCount: 16,
        waitingConditionCount: 17,
      },
      { processedCount: 19 },
      {
        processedCount: 19,
        succeededCount: 20,
        retryScheduledCount: 21,
        manualReviewCount: 22,
        reviewedCount: 23,
        minimizedCount: 24,
      },
      { processedCount: 25, nextDueAt: null },
      {
        expiredSessions: 26,
        verificationCodes: 27,
        verificationRequestLogs: 28,
        loginAttempts: 29,
        securityEvents: 30,
        cleanupLagSeconds: 31,
        ranAt: now.toISOString(),
      },
    ]);
    expect(tasks.map((task) => task.name)).toEqual([
      'matchTransitions',
      'threadTransitions',
      'matchHistory',
      'participantBackfill',
      'socialSafetyBookmarkCleanupSweep',
      'threadRetentionActivationSweep',
      'archiveJobSweep',
      'retainedIdentityDisposalSweep',
      'retentionReviewJobSweep',
      'retentionAccessLogDisposalSweep',
      'authCleanupSweep',
    ]);
    expect(tasks.map((task) => task.order)).toEqual([10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100]);
    expect(matchesService.sweepLifecycleTransitions).toHaveBeenCalledWith(now);
    expect(matchesService.sweepHistoryMaterialization).toHaveBeenCalledWith(now);
    expect(chatLifecycleSweep.sweepThreadLifecycle).toHaveBeenCalledWith(now);
    expect(seasonParticipantsService.backfillCurrentSeasonParticipants).toHaveBeenCalledWith(now);
    expect(bookmarkLifecycleService.expireEndedSeasonBookmarks).toHaveBeenCalledWith(now);
    expect(userRetentionSweep.activateThreadRetentionJobsForArchivedThreads).toHaveBeenCalledWith(
      now,
    );
    expect(userRetentionSweep.retryDueDeletionArchiveJobs).toHaveBeenCalledWith(now);
    expect(userRetentionSweep.disposeExpiredRetainedIdentities).toHaveBeenCalledWith(now);
    expect(userRetentionSweep.retryDueRetentionReviewJobs).toHaveBeenCalledWith(now);
    expect(userRetentionSweep.disposeDueRetentionAccessLogs).toHaveBeenCalledWith(now);
    expect(authOperationalCleanupService.runCleanupBatch).toHaveBeenCalledWith(now);
  });
});

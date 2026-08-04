import { describe, expect, it, vi } from 'vitest';
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
    const matchLifecycleSweep = {
      sweepMatchLifecycleTransitions: vi.fn().mockResolvedValue({
        expiredRequests: 1,
        expiredUnmatchRequests: 2,
        seasonEndedActiveMatches: 3,
      }),
    };
    const matchHistoryMaterialization = {
      materializeEndedSeasonHistory: vi
        .fn()
        .mockResolvedValue({ processedSeasons: 4, rebuiltEntries: 5 }),
    };
    const chatLifecycleSweep = {
      sweepThreadLifecycle: vi.fn().mockResolvedValue({ scannedCount: 6, updatedCount: 7 }),
    };
    const seasonParticipantsService = {
      backfillCurrentSeasonParticipants: vi.fn().mockResolvedValue([
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
      expireEndedSeasonBookmarks: vi.fn().mockResolvedValue({ scannedCount: 11, expiredCount: 10 }),
    };
    const retentionSweep = {
      activateThreadRetentionJobsForArchivedThreads: vi
        .fn()
        .mockResolvedValue({ activatedCount: 12 }),
      retryDueDeletionArchiveJobs: vi.fn().mockResolvedValue({
        processedCount: 13,
        succeededCount: 14,
        retryScheduledCount: 15,
        manualReviewCount: 16,
        waitingConditionCount: 17,
      }),
      disposeExpiredRetainedIdentities: vi.fn().mockResolvedValue({ processedCount: 19 }),
      retryDueRetentionReviewJobs: vi.fn().mockResolvedValue({
        processedCount: 19,
        succeededCount: 20,
        retryScheduledCount: 21,
        manualReviewCount: 22,
        reviewedCount: 23,
        minimizedCount: 24,
      }),
      disposeDueRetentionAccessLogs: vi.fn().mockResolvedValue({
        processedCount: 25,
        nextDueAt: null,
      }),
    };
    const authOperationalCleanupService = {
      runCleanupBatch: vi.fn().mockResolvedValue({
        expiredSessions: 26,
        verificationCodes: 27,
        verificationRequestLogs: 28,
        loginAttempts: 29,
        securityEvents: 30,
        batchSaturatedTargets: ['securityEvents'],
        ranAt: now.toISOString(),
      }),
    };

    const tasks = [
      new MatchLifecycleTransitionSweepTask(matchLifecycleSweep),
      new ChatThreadLifecycleSweepTask(chatLifecycleSweep),
      new MatchHistoryMaterializationSweepTask(matchHistoryMaterialization as never),
      new SeasonParticipantBackfillSweepTask(seasonParticipantsService as never),
      new SocialSafetyBookmarkCleanupSweepTask(bookmarkLifecycleService as never),
      new ThreadRetentionActivationSweepTask(retentionSweep),
      new ArchiveJobRetrySweepTask(retentionSweep),
      new RetainedIdentityDisposalSweepTask(retentionSweep),
      new RetentionReviewJobRetrySweepTask(retentionSweep),
      new RetentionAccessLogDisposalSweepTask(retentionSweep),
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
        batchSaturatedTargets: ['securityEvents'],
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
    expect(matchLifecycleSweep.sweepMatchLifecycleTransitions).toHaveBeenCalledWith(now);
    expect(matchHistoryMaterialization.materializeEndedSeasonHistory).toHaveBeenCalledWith(now);
    expect(chatLifecycleSweep.sweepThreadLifecycle).toHaveBeenCalledWith(now);
    expect(seasonParticipantsService.backfillCurrentSeasonParticipants).toHaveBeenCalledWith(now);
    expect(bookmarkLifecycleService.expireEndedSeasonBookmarks).toHaveBeenCalledWith(now);
    expect(retentionSweep.activateThreadRetentionJobsForArchivedThreads).toHaveBeenCalledWith(now);
    expect(retentionSweep.retryDueDeletionArchiveJobs).toHaveBeenCalledWith(now);
    expect(retentionSweep.disposeExpiredRetainedIdentities).toHaveBeenCalledWith(now);
    expect(retentionSweep.retryDueRetentionReviewJobs).toHaveBeenCalledWith(now);
    expect(retentionSweep.disposeDueRetentionAccessLogs).toHaveBeenCalledWith(now);
    expect(authOperationalCleanupService.runCleanupBatch).toHaveBeenCalledWith(now);
  });
});

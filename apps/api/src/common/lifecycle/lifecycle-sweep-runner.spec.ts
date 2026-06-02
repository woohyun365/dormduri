import { createLifecycleSweepRunner } from './lifecycle-sweep-runner.js';

describe('createLifecycleSweepRunner', () => {
  it('runs chat thread lifecycle through the narrow sweep port', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const chatLifecycleSweep = {
      sweepThreadLifecycle: jest.fn().mockResolvedValue({ scannedCount: 2, updatedCount: 1 }),
    };
    const matchesService = {
      sweepLifecycleTransitions: jest.fn().mockResolvedValue({ expiredUnmatchRequests: 0 }),
      sweepHistoryMaterialization: jest.fn().mockResolvedValue({ upsertedCount: 0 }),
    };
    const seasonParticipantsService = {
      backfillCurrentSeasonParticipants: jest.fn().mockResolvedValue({ backfilledCount: 0 }),
    };
    const usersService = {
      activateThreadRetentionJobsForArchivedThreads: jest.fn().mockResolvedValue({ activated: 0 }),
      retryDueDeletionArchiveJobs: jest.fn().mockResolvedValue({ retried: 0 }),
      disposeExpiredRetainedIdentities: jest.fn().mockResolvedValue({ disposed: 0 }),
      retryDueRetentionReviewJobs: jest.fn().mockResolvedValue({ retried: 0 }),
      disposeDueRetentionAccessLogs: jest.fn().mockResolvedValue({ disposed: 0 }),
    };
    const retentionObservability = {
      emitSweep: jest.fn().mockResolvedValue(undefined),
    };

    const runner = createLifecycleSweepRunner({
      prisma: { getDatabaseNow: jest.fn().mockResolvedValue(now) } as never,
      retentionPrisma: {} as never,
      retentionObservability,
      chatLifecycleSweep,
      matchesService: matchesService as never,
      seasonParticipantsService: seasonParticipantsService as never,
      usersService: usersService as never,
    });

    const result = await runner.runSweep();

    expect(chatLifecycleSweep.sweepThreadLifecycle).toHaveBeenCalledWith(now);
    expect(result.threadTransitions).toEqual({ scannedCount: 2, updatedCount: 1 });
    expect(retentionObservability.emitSweep).toHaveBeenCalledWith(
      expect.objectContaining({ result, now }),
    );
  });
});

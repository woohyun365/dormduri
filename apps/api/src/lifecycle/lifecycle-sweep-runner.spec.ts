import type { LifecycleSweepTaskPort } from './lifecycle-sweep-task.port.js';
import { createLifecycleSweepRunner } from './lifecycle-sweep-runner.js';

describe('createLifecycleSweepRunner', () => {
  it('runs ordered sweep tasks and preserves the lifecycle result shape', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const retentionObservability = {
      emitSweep: jest.fn().mockResolvedValue(undefined),
    };
    const calls: string[] = [];
    const tasks: LifecycleSweepTaskPort[] = [
      makeTask('authCleanupSweep', 100, calls, {
        expiredSessions: 1,
        verificationCodes: 2,
        verificationRequestLogs: 3,
        loginAttempts: 4,
        securityEvents: 5,
        cleanupLagSeconds: 0,
        ranAt: now.toISOString(),
      }),
      makeTask('matchTransitions', 10, calls, {
        expiredRequests: 0,
        expiredUnmatchRequests: 0,
        seasonEndedActiveMatches: 0,
      }),
      makeTask('threadTransitions', 20, calls, { scannedCount: 2, updatedCount: 1 }),
      makeTask('matchHistory', 30, calls, { processedSeasons: 0, rebuiltEntries: 0 }),
      makeTask('participantBackfill', 40, calls, []),
      makeTask('socialSafetyBookmarkCleanupSweep', 45, calls, {
        scannedCount: 2,
        expiredCount: 1,
      }),
      makeTask('threadRetentionActivationSweep', 50, calls, { activatedCount: 0 }),
      makeTask('archiveJobSweep', 60, calls, {
        processedCount: 0,
        succeededCount: 0,
        retryScheduledCount: 0,
        manualReviewCount: 0,
        waitingConditionCount: 0,
      }),
      makeTask('retainedIdentityDisposalSweep', 70, calls, { processedCount: 0 }),
      makeTask('retentionReviewJobSweep', 80, calls, {
        processedCount: 0,
        succeededCount: 0,
        retryScheduledCount: 0,
        manualReviewCount: 0,
        reviewedCount: 0,
        minimizedCount: 0,
      }),
      makeTask('retentionAccessLogDisposalSweep', 90, calls, {
        processedCount: 0,
        nextDueAt: null,
      }),
    ];

    const runner = createLifecycleSweepRunner({
      prisma: { getDatabaseNow: jest.fn().mockResolvedValue(now) } as never,
      retentionPrisma: {} as never,
      retentionObservability,
      tasks,
    });

    const result = await runner.runSweep();

    expect(calls).toEqual([
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
    expect(result).toMatchObject({
      ranAt: now.toISOString(),
      threadTransitions: { scannedCount: 2, updatedCount: 1 },
      socialSafetyBookmarkCleanupSweep: { scannedCount: 2, expiredCount: 1 },
      authCleanupSweep: {
        expiredSessions: 1,
        verificationCodes: 2,
        verificationRequestLogs: 3,
        loginAttempts: 4,
        securityEvents: 5,
      },
    });
    expect(retentionObservability.emitSweep).toHaveBeenCalledWith(
      expect.objectContaining({ result, now }),
    );
  });

  it('does not fail lifecycle convergence when retention observability fails', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const logger = { error: jest.fn() };
    const tasks: LifecycleSweepTaskPort[] = [
      makeTask('matchTransitions', 10, [], {
        expiredRequests: 0,
        expiredUnmatchRequests: 0,
        seasonEndedActiveMatches: 0,
      }),
      makeTask('threadTransitions', 20, [], { scannedCount: 0, updatedCount: 0 }),
      makeTask('matchHistory', 30, [], { processedSeasons: 0, rebuiltEntries: 0 }),
      makeTask('participantBackfill', 40, [], []),
      makeTask('socialSafetyBookmarkCleanupSweep', 45, [], {
        scannedCount: 0,
        expiredCount: 0,
      }),
      makeTask('threadRetentionActivationSweep', 50, [], { activatedCount: 0 }),
      makeTask('archiveJobSweep', 60, [], {
        processedCount: 0,
        succeededCount: 0,
        retryScheduledCount: 0,
        manualReviewCount: 0,
        waitingConditionCount: 0,
      }),
      makeTask('retainedIdentityDisposalSweep', 70, [], { processedCount: 0 }),
      makeTask('retentionReviewJobSweep', 80, [], {
        processedCount: 0,
        succeededCount: 0,
        retryScheduledCount: 0,
        manualReviewCount: 0,
        reviewedCount: 0,
        minimizedCount: 0,
      }),
      makeTask('retentionAccessLogDisposalSweep', 90, [], {
        processedCount: 0,
        nextDueAt: null,
      }),
      makeTask('authCleanupSweep', 100, [], {
        expiredSessions: 0,
        verificationCodes: 0,
        verificationRequestLogs: 0,
        loginAttempts: 0,
        securityEvents: 0,
        cleanupLagSeconds: 0,
        ranAt: now.toISOString(),
      }),
    ];

    const runner = createLifecycleSweepRunner({
      prisma: { getDatabaseNow: jest.fn().mockResolvedValue(now) } as never,
      retentionPrisma: {} as never,
      retentionObservability: {
        emitSweep: jest.fn().mockRejectedValue(new Error('observability down')),
      },
      tasks,
      logger,
    });

    await expect(runner.runSweep()).resolves.toMatchObject({ ranAt: now.toISOString() });
    expect(logger.error).toHaveBeenCalledWith(
      'Lifecycle retention observability emission failed',
      expect.stringContaining('observability down'),
    );
  });
});

function makeTask<TName extends LifecycleSweepTaskPort['name']>(
  name: TName,
  order: number,
  calls: string[],
  result: Awaited<ReturnType<LifecycleSweepTaskPort<TName>['run']>>,
): LifecycleSweepTaskPort<TName> {
  return {
    name,
    order,
    run() {
      calls.push(name);
      return Promise.resolve(result);
    },
  };
}

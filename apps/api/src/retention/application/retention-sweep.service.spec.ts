import { RetentionSweepService } from './retention-sweep.service.js';

function makeRetentionWorkerPrisma() {
  return {
    $queryRawTyped: jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
    archiveJob: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    conversationThread: {
      findMany: jest.fn(),
    },
    retainedIdentity: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    retainedVaultObject: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    retentionAccessLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    retentionReviewJob: {
      update: jest.fn(),
    },
  };
}

describe('RetentionSweepService', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  it('retention owner functions를 RetentionWorkerPrismaService boundary로 위임한다', async () => {
    const retentionWorkerPrisma = makeRetentionWorkerPrisma();
    const service = new RetentionSweepService(retentionWorkerPrisma as never);

    await expect(service.activateThreadRetentionJobsForArchivedThreads(now)).resolves.toEqual({
      activatedCount: 0,
    });
    await expect(service.retryDueDeletionArchiveJobs(now)).resolves.toEqual({
      processedCount: 0,
      succeededCount: 0,
      retryScheduledCount: 0,
      manualReviewCount: 0,
      waitingConditionCount: 0,
    });
    await expect(service.disposeExpiredRetainedIdentities(now)).resolves.toEqual({
      processedCount: 0,
    });
    await expect(service.retryDueRetentionReviewJobs(now)).resolves.toEqual({
      processedCount: 0,
      succeededCount: 0,
      retryScheduledCount: 0,
      manualReviewCount: 0,
      reviewedCount: 0,
      minimizedCount: 0,
    });
    await expect(service.disposeDueRetentionAccessLogs(now)).resolves.toEqual({
      processedCount: 0,
      nextDueAt: null,
    });

    type RetainedIdentityFindManyArgs = { take: number; where: { retentionDisposedAt: null } };
    type RetainedVaultObjectFindManyArgs = { take: number; where: { state: string } };

    expect(retentionWorkerPrisma.$queryRawTyped).toHaveBeenCalledTimes(3);
    expect(retentionWorkerPrisma.archiveJob.findMany).toHaveBeenCalledTimes(1);
    const [[retainedIdentityFindManyArgs]] = retentionWorkerPrisma.retainedIdentity.findMany.mock
      .calls as [[RetainedIdentityFindManyArgs]];
    expect(retainedIdentityFindManyArgs.where.retentionDisposedAt).toBeNull();
    expect(retainedIdentityFindManyArgs.take).toBe(100);

    const [[retainedVaultObjectFindManyArgs]] = retentionWorkerPrisma.retainedVaultObject.findMany
      .mock.calls as [[RetainedVaultObjectFindManyArgs]];
    expect(retainedVaultObjectFindManyArgs.where.state).toBe('RETAINED');
    expect(retainedVaultObjectFindManyArgs.take).toBe(100);
  });
});

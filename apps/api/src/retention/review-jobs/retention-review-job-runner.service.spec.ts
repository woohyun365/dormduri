import { retryDueRetentionReviewJobs } from './retention-review-job-runner.service.js';

type RetentionReviewJobUpdateInput = {
  where: { id: string };
  data: Record<string, unknown>;
};

function createAccessLogDisposalStore(input: { nextDueAt?: Date | null }) {
  const updates: RetentionReviewJobUpdateInput[] = [];
  const retentionReviewJob = {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'review-access-log-disposal',
        target: 'ACCESS_LOG_DISPOSAL',
        sourceId: 'retention-access-log-hard-disposal',
        attemptCount: 0,
        maxAttempts: 5,
        payload: null,
        manualReviewRequired: false,
      },
    ]),
    update: jest.fn().mockImplementation((update: RetentionReviewJobUpdateInput) => {
      updates.push(update);
      return Promise.resolve(undefined);
    }),
  };
  const retentionAccessLog = {
    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    findFirst: jest
      .fn()
      .mockResolvedValue(input.nextDueAt ? { logRetentionHoldUntil: input.nextDueAt } : null),
  };

  return {
    prisma: { retentionReviewJob, retentionAccessLog },
    updates,
  };
}

describe('retention review job runner', () => {
  it('ACCESS_LOG_DISPOSAL job은 다음 due log가 있으면 같은 review job을 다시 예약한다', async () => {
    const now = new Date('2029-05-12T00:00:00.000Z');
    const nextDueAt = new Date('2029-06-01T00:00:00.000Z');
    const store = createAccessLogDisposalStore({ nextDueAt });

    const result = await retryDueRetentionReviewJobs(store.prisma as never, now);

    expect(result).toMatchObject({
      processedCount: 1,
      succeededCount: 1,
      reviewedCount: 2,
      minimizedCount: 2,
    });
    expect(store.updates[0]).toMatchObject({
      where: { id: 'review-access-log-disposal' },
      data: {
        status: 'PENDING',
        dueAt: nextDueAt,
        lastSucceededAt: now,
      },
    });
  });

  it('ACCESS_LOG_DISPOSAL job은 남은 due log가 없으면 성공 상태로 닫는다', async () => {
    const now = new Date('2029-05-12T00:00:00.000Z');
    const store = createAccessLogDisposalStore({ nextDueAt: null });

    await retryDueRetentionReviewJobs(store.prisma as never, now);

    expect(store.updates[0]).toMatchObject({
      where: { id: 'review-access-log-disposal' },
      data: {
        status: 'SUCCEEDED',
        lastSucceededAt: now,
      },
    });
  });
});

import { HotDbArchiveAdapter, retryDueArchiveJobs } from './archive-job-owner.js';

describe('archive job owner', () => {
  function createArchiveJobStore(job: {
    id: string;
    archiveTier?: 'HOT_DB' | 'COLD_ARCHIVE';
    manualReviewRequired?: boolean;
    attemptCount?: number;
    maxAttempts?: number;
    target?:
      | 'RETAINED_IDENTITY'
      | 'THREAD_RETENTION'
      | 'NICKNAME_AUDIT'
      | 'SEASON_PROFILE_HISTORY'
      | 'MATCH_HISTORY';
    retainedIdentityPayloadMissing?: boolean;
    threadId?: string | null;
    threadStatus?: 'OPEN' | 'READ_ONLY' | 'ARCHIVED' | null;
  }) {
    const updates: unknown[] = [];
    const dueJob = {
      id: job.id,
      target: job.target ?? 'RETAINED_IDENTITY',
      status: 'PENDING',
      archiveTier: job.archiveTier ?? 'HOT_DB',
      retainedIdentityId: 'retained-1',
      userId: 'user-1',
      seasonId: null,
      participantId: null,
      matchHistoryEntryId: null,
      threadId: job.threadId ?? null,
      attemptCount: job.attemptCount ?? 0,
      maxAttempts: job.maxAttempts ?? 5,
      nextRunAt: new Date('2026-05-13T00:00:00.000Z'),
      lastErrorCode: null,
      manualReviewRequired: job.manualReviewRequired ?? false,
      payload: null,
    };

    return {
      updates,
      prisma: {
        archiveJob: {
          findMany: jest.fn().mockResolvedValue([dueJob]),
          update: jest.fn().mockImplementation((input: unknown) => {
            updates.push(input);
            return Promise.resolve(undefined);
          }),
        },
        retainedIdentity: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'retained-1',
            retentionReason: 'ACCOUNT_DELETION',
            retentionHoldUntil: new Date('2026-05-18T00:00:00.000Z'),
            retentionDisposedAt: null,
            encryptedIdentifierPayload: job.retainedIdentityPayloadMissing
              ? null
              : { schemaVersion: 1 },
            identifierKeyVersion: job.retainedIdentityPayloadMissing ? null : 'test-v1',
          }),
        },
        conversationThread: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              job.threadStatus === null
                ? null
                : job.threadId
                  ? { id: job.threadId, status: job.threadStatus ?? 'OPEN' }
                  : null,
            ),
        },
        runSerializableTransaction: jest.fn(),
      },
    };
  }

  it('HOT_DB archive job은 성공 처리한다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({ id: 'job-success' });

    const result = await retryDueArchiveJobs(store.prisma as never, now, new HotDbArchiveAdapter());

    expect(result).toMatchObject({
      processedCount: 1,
      succeededCount: 1,
      retryScheduledCount: 0,
      manualReviewCount: 0,
    });
    expect(store.updates[0]).toMatchObject({
      where: { id: 'job-success' },
      data: {
        status: 'SUCCEEDED',
        attemptCount: 1,
        lastAttemptAt: now,
        lastSucceededAt: now,
      },
    });
  });

  it('RETAINED_IDENTITY validation 실패는 maxAttempts 전까지 retry를 예약한다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({
      id: 'job-retry',
      attemptCount: 1,
      maxAttempts: 5,
      retainedIdentityPayloadMissing: true,
    });

    const result = await retryDueArchiveJobs(store.prisma as never, now, new HotDbArchiveAdapter());

    expect(result.retryScheduledCount).toBe(1);
    expect(store.updates[0]).toMatchObject({
      where: { id: 'job-retry' },
      data: {
        status: 'RETRY_SCHEDULED',
        attemptCount: 2,
        lastErrorCode: 'RETAINED_IDENTITY_IDENTIFIER_PAYLOAD_MISSING',
      },
    });
  });

  it('HOT_DB 외 archiveTier는 현재 adapter에서 처리하지 않고 retry 대상으로 남긴다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({ id: 'job-cold', archiveTier: 'COLD_ARCHIVE' });

    const result = await retryDueArchiveJobs(store.prisma as never, now, new HotDbArchiveAdapter());

    expect(result.retryScheduledCount).toBe(1);
    expect(store.updates[0]).toMatchObject({
      where: { id: 'job-cold' },
      data: {
        status: 'RETRY_SCHEDULED',
        attemptCount: 1,
        lastErrorCode: 'UNSUPPORTED_ARCHIVE_TIER',
      },
    });
  });

  it('THREAD_RETENTION job은 thread가 archive 전이면 retry를 소비하지 않고 대기 상태로 돌린다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({
      id: 'job-thread-waiting',
      target: 'THREAD_RETENTION',
      threadId: 'thread-1',
      threadStatus: 'READ_ONLY',
    });

    const result = await retryDueArchiveJobs(store.prisma as never, now, new HotDbArchiveAdapter());

    expect(result).toMatchObject({
      processedCount: 1,
      waitingConditionCount: 1,
      succeededCount: 0,
      retryScheduledCount: 0,
      manualReviewCount: 0,
    });
    expect(store.updates[0]).toMatchObject({
      where: { id: 'job-thread-waiting' },
      data: {
        status: 'WAITING_CONDITION',
        lastErrorCode: 'THREAD_NOT_ARCHIVED',
        manualReviewRequired: false,
      },
    });
    expect(store.prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('manualReviewRequired job은 재시도하지 않고 수동 검토로 고정한다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({ id: 'job-manual', manualReviewRequired: true });

    const result = await retryDueArchiveJobs(store.prisma as never, now, new HotDbArchiveAdapter());

    expect(result.manualReviewCount).toBe(1);
    expect(store.updates[0]).toMatchObject({
      where: { id: 'job-manual' },
      data: {
        status: 'FAILED_MANUAL_REVIEW',
        manualReviewRequired: true,
        lastErrorCode: 'MANUAL_REVIEW_REQUIRED',
      },
    });
  });
});

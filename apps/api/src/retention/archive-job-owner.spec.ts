import { createDeletionArchiveJobsTx, retryDueArchiveJobs } from './archive-job-owner.js';

type ArchiveJobUpdateInput = { where: { id: string }; data: Record<string, unknown> };
type ReviewJobUpsertInput = {
  where: { target_sourceId: { target: string; sourceId: string } };
  create: { target: string; sourceId: string; dueAt: Date };
};
type CreatedArchiveJob = { target: string };

describe('archive job owner', () => {
  function createArchiveJobStore(job: {
    id: string;
    manualReviewRequired?: boolean;
    attemptCount?: number;
    maxAttempts?: number;
    target?: 'THREAD_RETENTION' | 'NICKNAME_AUDIT' | 'SEASON_PROFILE_HISTORY' | 'MATCH_HISTORY';
    threadId?: string | null;
    threadStatus?: 'OPEN' | 'READ_ONLY' | 'ARCHIVED' | null;
  }) {
    const updates: ArchiveJobUpdateInput[] = [];
    const tx = {
      conversationMessage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      retentionCase: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'case-chat' }),
      },
      retentionReviewJob: {
        upsert: jest.fn().mockResolvedValue({ id: 'review-thread-1' }),
      },
    };
    const dueJob = {
      id: job.id,
      target: job.target ?? 'THREAD_RETENTION',
      status: 'PENDING',
      retainedIdentityId: 'retained-1',
      userId: 'user-1',
      seasonId: null,
      participantId: null,
      matchHistoryEntryId: null,
      threadId: job.threadId ?? 'thread-1',
      attemptCount: job.attemptCount ?? 0,
      maxAttempts: job.maxAttempts ?? 5,
      nextRunAt: new Date('2026-05-13T00:00:00.000Z'),
      lastErrorCode: null,
      manualReviewRequired: job.manualReviewRequired ?? false,
      payload: {
        schemaVersion: 1,
        identityReviewAfter: '2028-05-12T00:00:00.000Z',
      },
    };

    return {
      updates,
      tx,
      prisma: {
        archiveJob: {
          findMany: jest.fn().mockResolvedValue([dueJob]),
          update: jest.fn().mockImplementation((input: ArchiveJobUpdateInput) => {
            updates.push(input);
            return Promise.resolve(undefined);
          }),
        },
        conversationThread: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              job.threadStatus === null
                ? null
                : job.threadId === null
                  ? null
                  : { id: job.threadId ?? 'thread-1', status: job.threadStatus ?? 'ARCHIVED' },
            ),
        },
        runSerializableTransaction: jest.fn(<T>(callback: (transaction: typeof tx) => T) =>
          callback(tx),
        ),
      },
    };
  }

  it('THREAD_RETENTION archive job은 retained body 처리 후 review job을 예약하고 성공 처리한다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({ id: 'job-success', threadStatus: 'ARCHIVED' });

    const result = await retryDueArchiveJobs(store.prisma as never, now);

    expect(result).toMatchObject({
      processedCount: 1,
      succeededCount: 1,
      retryScheduledCount: 0,
      manualReviewCount: 0,
    });
    const reviewJobUpsert = store.tx.retentionReviewJob.upsert as jest.MockedFunction<
      (input: ReviewJobUpsertInput) => Promise<{ id: string }>
    >;
    const reviewJobUpsertInput = reviewJobUpsert.mock.calls[0]?.[0];
    expect(reviewJobUpsertInput?.where.target_sourceId).toEqual({
      target: 'CHAT_IDENTITY_LINK',
      sourceId: 'thread-1',
    });
    expect(reviewJobUpsertInput?.create).toMatchObject({
      target: 'CHAT_IDENTITY_LINK',
      sourceId: 'thread-1',
      dueAt: new Date('2028-05-12T00:00:00.000Z'),
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

  it('THREAD_RETENTION job은 thread가 archive 전이면 retry를 소비하지 않고 대기 상태로 돌린다', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const store = createArchiveJobStore({
      id: 'job-thread-waiting',
      target: 'THREAD_RETENTION',
      threadId: 'thread-1',
      threadStatus: 'READ_ONLY',
    });

    const result = await retryDueArchiveJobs(store.prisma as never, now);

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

    const result = await retryDueArchiveJobs(store.prisma as never, now);

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

  it('계정 삭제 archive job은 retained identity marker target 없이 payload transformation target만 만든다', async () => {
    const created: CreatedArchiveJob[] = [];
    const tx = {
      seasonParticipant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'participant-1', seasonId: 'season-1' }]),
      },
      seasonParticipantProfileHistory: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ participantId: 'participant-1', seasonId: 'season-1' }]),
      },
      seasonMatchHistoryEntry: {
        findMany: jest.fn().mockResolvedValue([{ id: 'match-history-1', seasonId: 'season-1' }]),
      },
      conversationThread: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'thread-1', seasonId: 'season-1', status: 'ARCHIVED' },
          { id: 'thread-2', seasonId: 'season-1', status: 'READ_ONLY' },
        ]),
      },
      userDisplayIdentityNicknameChangeEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      archiveJob: {
        createMany: jest.fn().mockImplementation(({ data }: { data: CreatedArchiveJob[] }) => {
          created.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
    };

    const result = await createDeletionArchiveJobsTx(tx as never, {
      retainedIdentityId: 'retained-1',
      userId: 'user-1',
      deletedAt: new Date('2026-05-13T00:00:00.000Z'),
    });

    expect(result).toEqual({ createdCount: 5 });
    expect(created.map((job) => job.target).sort()).toEqual([
      'MATCH_HISTORY',
      'NICKNAME_AUDIT',
      'SEASON_PROFILE_HISTORY',
      'THREAD_RETENTION',
      'THREAD_RETENTION',
    ]);
  });
});

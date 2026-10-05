import { readChatRealtimeProxyProfile } from './chat-realtime.config.js';
import { describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ChatRealtimeDispatcherService } from './chat-realtime-dispatcher.service.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';

const now = new Date('2026-02-10T03:00:00.000Z');

function createClaimedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    eventType: 'chat.read_marker.updated',
    schemaVersion: 1,
    threadId: 'thread-1',
    aggregateType: 'conversation.thread_member',
    aggregateId: 'thread-1',
    aggregateVersion: null,
    payload: {
      threadId: 'thread-1',
      lastReadMessageId: 'message-1',
    },
    roomKeys: ['user:user-1'],
    occurredAt: new Date('2026-02-10T02:59:00.000Z'),
    availableAt: now,
    publishAttempts: 1,
    ...overrides,
  };
}

function createDispatcher(input: {
  queryRows?: unknown[][];
  publisherBound?: boolean;
  publishRejects?: Error;
  dispatcherEnabled?: boolean;
}) {
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    $queryRawTyped: vi.fn(),
    chatRealtimeOutboxEvent: {
      update: vi.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
  for (const rows of input.queryRows ?? []) {
    prisma.$queryRawTyped.mockResolvedValueOnce(rows);
  }
  const publishError = input.publishRejects;
  const publisher = {
    isBound: vi.fn().mockReturnValue(input.publisherBound ?? true),
    publishOutboxEvent: publishError
      ? vi.fn(() => {
          throw publishError;
        })
      : vi.fn(() => undefined),
  };
  const metrics = new ChatRealtimeMetricsService();
  const settings = {
    allowedOrigins: false as const,
    proxyProfile: readChatRealtimeProxyProfile({}),
    dispatcherEnabled: input.dispatcherEnabled ?? false,
    dispatcherIntervalMs: 1_000,
    dispatcherBatchSize: 50,
    dispatcherClaimLeaseMs: 30_000,
    dispatcherRetryBaseMs: 1_000,
    dispatcherRetryMaxMs: 60_000,
    messageUserLimit: 30,
    messageUserWindowMs: 60_000,
    messagePairLimit: 20,
    messagePairWindowMs: 60_000,
    messageBurstLimit: 5,
    messageBurstWindowMs: 10_000,
    ticketUserLimit: 10,
    ticketUserWindowMs: 60_000,
    ticketIpLimit: 60,
    ticketIpWindowMs: 60_000,
    wsConnectIpLimit: 30,
    wsConnectIpWindowMs: 60_000,
    wsConnectUserLimit: 10,
    wsConnectUserWindowMs: 60_000,
    wsConcurrentUserLimit: 5,
    wsSubscribeSocketLimit: 60,
    wsSubscribeSocketWindowMs: 60_000,
    wsSubscribeFailureLimit: 10,
    wsSubscribeFailureWindowMs: 60_000,
  };

  return {
    prisma,
    publisher,
    metrics,
    dispatcher: new ChatRealtimeDispatcherService(
      prisma as never,
      publisher as never,
      metrics,
      settings,
    ),
  };
}

describe('ChatRealtimeDispatcherService', () => {
  it.each([true, false])(
    'enabled=%s에 따라 timer를 등록하고 destroy 뒤에는 실행하지 않는다',
    async (enabled) => {
      vi.useFakeTimers();
      const { dispatcher, prisma } = createDispatcher({
        dispatcherEnabled: enabled,
        queryRows: [[], [{ deletedCount: 0 }]],
      });
      try {
        dispatcher.onApplicationBootstrap();
        expect(vi.getTimerCount()).toBe(enabled ? 1 : 0);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(enabled ? 1 : 0);
        expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(enabled ? 2 : 0);
        dispatcher.onModuleDestroy();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(enabled ? 1 : 0);
      } finally {
        dispatcher.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );

  it.each(['clock', 'claim'] as const)(
    '%s 초기 실패 뒤 다음 timer tick은 다시 claim/publish한다',
    async (failurePoint) => {
      vi.useFakeTimers();
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { dispatcher, prisma, publisher, metrics } = createDispatcher({
        dispatcherEnabled: true,
      });
      const error = new Error(`${failurePoint} unavailable`);
      if (failurePoint === 'clock') prisma.getDatabaseNow.mockRejectedValueOnce(error);
      else prisma.$queryRawTyped.mockRejectedValueOnce(error);
      prisma.$queryRawTyped
        .mockResolvedValueOnce([createClaimedEvent()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ deletedCount: 0 }]);
      try {
        dispatcher.onApplicationBootstrap();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(warn).toHaveBeenCalledOnce();
        expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(failurePoint === 'clock' ? 0 : 1);
        expect(publisher.publishOutboxEvent).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(2);
        expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(failurePoint === 'clock' ? 3 : 4);
        expect(publisher.publishOutboxEvent).toHaveBeenCalledOnce();
        expect(prisma.chatRealtimeOutboxEvent.update).toHaveBeenCalledOnce();
        expect(metrics.snapshot().dispatchers.chat.totalPublished).toBe(1);
        expect(metrics.snapshot().outboxPrune.totalFailures).toBe(0);
        expect(warn).toHaveBeenCalledOnce();
      } finally {
        dispatcher.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        warn.mockRestore();
      }
    },
  );

  it('publisher가 아직 bind되지 않았으면 claim하지 않고 skip한다', async () => {
    const { dispatcher, prisma, metrics } = createDispatcher({
      publisherBound: false,
    });

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      skippedReason: 'PUBLISHER_UNBOUND',
    });
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
    expect(metrics.snapshot().dispatchers.chat).toMatchObject({
      totalSkippedPublisherUnbound: 1,
      lastSkippedReason: 'PUBLISHER_UNBOUND',
      lastRunAt: now.toISOString(),
    });
  });

  it('claim된 outbox event를 publish하고 publishedAt을 mark한다', async () => {
    const event = createClaimedEvent();
    const { dispatcher, prisma, publisher, metrics } = createDispatcher({
      queryRows: [
        [event],
        [
          {
            eventId: 'event-1',
            userId: 'user-1',
            threadId: 'thread-1',
            cursor: 'event-1:user-1',
          },
        ],
        [{ deletedCount: 0 }],
      ],
    });

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 1,
      publishedCount: 1,
      failedCount: 0,
      skippedReason: null,
    });

    expect(publisher.publishOutboxEvent).toHaveBeenCalledWith({
      event,
      recipients: [
        {
          eventId: 'event-1',
          userId: 'user-1',
          threadId: 'thread-1',
          cursor: 'event-1:user-1',
        },
      ],
    });
    expect(prisma.chatRealtimeOutboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: {
        publishedAt: now,
        lastPublishError: null,
        updatedAt: now,
      },
    });
    expect(metrics.snapshot().oldestClaimedOutboxLagSeconds).toBe(60);
    expect(metrics.snapshot().dispatchers.chat).toMatchObject({
      totalClaimed: 1,
      totalPublished: 1,
      totalFailed: 0,
      oldestClaimedOutboxLagSeconds: 60,
    });
  });

  it('claim된 chat.thread.updated event를 recipient와 함께 publisher로 넘긴다', async () => {
    const event = createClaimedEvent({
      id: 'event-thread-updated',
      eventType: 'chat.thread.updated',
      aggregateType: 'conversation.thread',
      aggregateId: 'thread-1',
      payload: {
        threadId: 'thread-1',
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
      },
      roomKeys: ['user:user-1', 'user:user-3'],
    });
    const { dispatcher, publisher } = createDispatcher({
      queryRows: [
        [event],
        [
          {
            eventId: 'event-thread-updated',
            userId: 'user-1',
            threadId: 'thread-1',
            cursor: 'event-thread-updated:user-1',
          },
          {
            eventId: 'event-thread-updated',
            userId: 'user-3',
            threadId: 'thread-1',
            cursor: 'event-thread-updated:user-3',
          },
        ],
        [{ deletedCount: 0 }],
      ],
    });

    await expect(dispatcher.dispatchOnce(now)).resolves.toMatchObject({
      claimedCount: 1,
      publishedCount: 1,
      failedCount: 0,
    });

    expect(publisher.publishOutboxEvent).toHaveBeenCalledWith({
      event,
      recipients: [
        {
          eventId: 'event-thread-updated',
          userId: 'user-1',
          threadId: 'thread-1',
          cursor: 'event-thread-updated:user-1',
        },
        {
          eventId: 'event-thread-updated',
          userId: 'user-3',
          threadId: 'thread-1',
          cursor: 'event-thread-updated:user-3',
        },
      ],
    });
  });

  it('dispatch tick이 겹쳐도 running guard로 같은 프로세스 안의 중복 claim을 막는다', async () => {
    const event = createClaimedEvent();
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      $queryRawTyped: vi
        .fn()
        .mockResolvedValueOnce([event])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ deletedCount: 0 }]),
      chatRealtimeOutboxEvent: {
        update: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const metrics = new ChatRealtimeMetricsService();
    let dispatcher: ChatRealtimeDispatcherService | null = null;
    let nestedDispatch: Promise<unknown> | null = null;
    const publisher = {
      isBound: vi.fn().mockReturnValue(true),
      publishOutboxEvent: vi.fn(() => {
        if (!dispatcher) {
          throw new Error('dispatcher is required before publish');
        }
        nestedDispatch = dispatcher.dispatchOnce(now);
      }),
    };
    const settings = {
      allowedOrigins: false as const,
      proxyProfile: readChatRealtimeProxyProfile({}),
      dispatcherEnabled: false,
      dispatcherIntervalMs: 1_000,
      dispatcherBatchSize: 50,
      dispatcherClaimLeaseMs: 30_000,
      dispatcherRetryBaseMs: 1_000,
      dispatcherRetryMaxMs: 60_000,
      messageUserLimit: 30,
      messageUserWindowMs: 60_000,
      messagePairLimit: 20,
      messagePairWindowMs: 60_000,
      messageBurstLimit: 5,
      messageBurstWindowMs: 10_000,
      ticketUserLimit: 10,
      ticketUserWindowMs: 60_000,
      ticketIpLimit: 60,
      ticketIpWindowMs: 60_000,
      wsConnectIpLimit: 30,
      wsConnectIpWindowMs: 60_000,
      wsConnectUserLimit: 10,
      wsConnectUserWindowMs: 60_000,
      wsConcurrentUserLimit: 5,
      wsSubscribeSocketLimit: 60,
      wsSubscribeSocketWindowMs: 60_000,
      wsSubscribeFailureLimit: 10,
      wsSubscribeFailureWindowMs: 60_000,
    };
    dispatcher = new ChatRealtimeDispatcherService(
      prisma as never,
      publisher as never,
      metrics,
      settings,
    );

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 1,
      publishedCount: 1,
      failedCount: 0,
      skippedReason: null,
    });
    expect(nestedDispatch).not.toBeNull();
    if (!nestedDispatch) {
      throw new Error('nested dispatch promise is required');
    }
    await expect(nestedDispatch).resolves.toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      skippedReason: null,
    });
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(3);
  });

  it('publish 실패는 business data를 롤백하지 않고 retry 가능한 outbox failure mark로 남기며 payload를 일반 로그에 남기지 않는다', async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { dispatcher, prisma, metrics } = createDispatcher({
      queryRows: [
        [
          createClaimedEvent({
            publishAttempts: 2,
            payload: {
              retainedOriginalBody: '로그에 남으면 안 되는 원문',
              internalAuditData: 'audit-secret',
            },
          }),
        ],
        [],
        [{ deletedCount: 0 }],
      ],
      publishRejects: new Error('socket publish failed: 로그에 남으면 안 되는 원문'),
    });

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 1,
      publishedCount: 0,
      failedCount: 1,
      skippedReason: null,
    });

    try {
      expect(prisma.chatRealtimeOutboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: {
          availableAt: new Date('2026-02-10T03:00:02.000Z'),
          lastPublishError: 'socket publish failed: 로그에 남으면 안 되는 원문',
          updatedAt: now,
        },
      });
      const warnOutput = loggerSpy.mock.calls.flat().join('\n');
      expect(warnOutput).toContain('eventId=event-1');
      expect(warnOutput).toContain('errorType=Error');
      expect(warnOutput).not.toContain('retainedOriginalBody');
      expect(warnOutput).not.toContain('internalAuditData');
      expect(warnOutput).not.toContain('로그에 남으면 안 되는 원문');
      expect(metrics.snapshot().publishFailures).toBe(1);
      expect(metrics.snapshot().dispatchers.chat.totalFailed).toBe(1);
    } finally {
      loggerSpy.mockRestore();
    }
  });

  it('replay window prune은 dispatcher가 주기적으로 호출하고 너무 잦은 delete를 피한다', async () => {
    const { dispatcher, prisma, metrics } = createDispatcher({
      queryRows: [[], [{ deletedCount: 2 }], []],
    });

    await expect(dispatcher.dispatchOnce(now)).resolves.toMatchObject({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
    });
    await expect(
      dispatcher.dispatchOnce(new Date('2026-02-10T03:30:00.000Z')),
    ).resolves.toMatchObject({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
    });

    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(3);
    expect(metrics.snapshot().outboxPrune).toMatchObject({
      totalDeleted: 2,
      lastDeletedCount: 2,
      lastPrunedAt: now.toISOString(),
      totalFailures: 0,
    });
  });

  it('replay window prune 실패는 dispatch 결과를 깨지 않고 no-PII failure metric으로 남긴다', async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { dispatcher, prisma, metrics } = createDispatcher({
      queryRows: [[]],
    });
    prisma.$queryRawTyped.mockRejectedValueOnce(new Error('delete failed: 원문 body 노출 금지'));

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      skippedReason: null,
    });

    try {
      expect(metrics.snapshot().outboxPrune).toMatchObject({
        totalDeleted: 0,
        totalFailures: 1,
        lastDeletedCount: 0,
        lastFailureAt: now.toISOString(),
      });
      const warnOutput = loggerSpy.mock.calls.flat().join('\\n');
      expect(warnOutput).toContain('prune failed');
      expect(warnOutput).toContain('errorType=Error');
      expect(warnOutput).not.toContain('원문 body 노출 금지');
    } finally {
      loggerSpy.mockRestore();
    }
  });
});

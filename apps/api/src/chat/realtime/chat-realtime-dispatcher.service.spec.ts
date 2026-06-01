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
}) {
  const prisma = {
    getDatabaseNow: jest.fn().mockResolvedValue(now),
    $queryRaw: jest.fn(),
    chatRealtimeOutboxEvent: {
      update: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
  for (const rows of input.queryRows ?? []) {
    prisma.$queryRaw.mockResolvedValueOnce(rows);
  }
  const publishError = input.publishRejects;
  const publisher = {
    isBound: jest.fn().mockReturnValue(input.publisherBound ?? true),
    publishOutboxEvent: publishError
      ? jest.fn(() => {
          throw publishError;
        })
      : jest.fn(() => undefined),
  };
  const metrics = new ChatRealtimeMetricsService();
  const settings = {
    allowedOrigins: false as const,
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
  it('publisher가 아직 bind되지 않았으면 claim하지 않고 skip한다', async () => {
    const { dispatcher, prisma } = createDispatcher({
      publisherBound: false,
    });

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      skippedReason: 'PUBLISHER_UNBOUND',
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
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
  });

  it('dispatch tick이 겹쳐도 running guard로 같은 프로세스 안의 중복 claim을 막는다', async () => {
    const event = createClaimedEvent();
    const prisma = {
      getDatabaseNow: jest.fn().mockResolvedValue(now),
      $queryRaw: jest.fn().mockResolvedValueOnce([event]).mockResolvedValueOnce([]),
      chatRealtimeOutboxEvent: {
        update: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const metrics = new ChatRealtimeMetricsService();
    let dispatcher: ChatRealtimeDispatcherService | null = null;
    let nestedDispatch: Promise<unknown> | null = null;
    const publisher = {
      isBound: jest.fn().mockReturnValue(true),
      publishOutboxEvent: jest.fn(() => {
        if (!dispatcher) {
          throw new Error('dispatcher is required before publish');
        }
        nestedDispatch = dispatcher.dispatchOnce(now);
      }),
    };
    const settings = {
      allowedOrigins: false as const,
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
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('publish 실패는 business data를 롤백하지 않고 retry 가능한 outbox failure mark로 남기며 payload를 일반 로그에 남기지 않는다', async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
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
    } finally {
      loggerSpy.mockRestore();
    }
  });
});

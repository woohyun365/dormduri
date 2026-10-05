import { describe, expect, it, vi, type Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import { NotificationOutboxDispatcherService } from './notification-dispatcher.service.js';
import { ChatRealtimeMetricsService } from '../../chat/realtime/chat-realtime.metrics.js';

type PublisherMock = {
  isBound: Mock<() => boolean>;
  publishNotificationCreated: Mock<
    (arg0: { recipientUserId: string; event: Record<string, unknown> }) => void
  >;
};

type NotificationOutboxUpdateCall = [
  {
    where: { id: string };
    data: {
      status?: string;
      lastError?: string;
    };
  },
];

function createSettings(overrides: Partial<Record<string, number | boolean>> = {}) {
  return {
    dispatcherEnabled: false,
    dispatcherIntervalMs: 1_000,
    dispatcherBatchSize: 50,
    dispatcherClaimLeaseMs: 30_000,
    dispatcherRetryBaseMs: 1_000,
    dispatcherRetryMaxMs: 60_000,
    ...overrides,
  };
}

function createPrismaMock(eventPayload?: unknown) {
  const now = new Date('2026-06-02T00:00:00.000Z');
  return {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    $queryRawTyped: vi.fn().mockResolvedValue([
      {
        id: 'notification-event-1',
        notificationId: 'notification-1',
        recipientUserId: 'user-b',
        eventType: 'notification.created',
        schemaVersion: 1,
        payload: eventPayload ?? {
          notification: {
            id: 'notification-1',
            recipientUserId: 'user-b',
            actorUserId: 'user-a',
            kind: 'CHAT_THREAD_CREATED',
            sourceType: 'CONVERSATION_THREAD',
            sourceId: 'thread-1',
            payload: {
              kind: 'CHAT_THREAD_CREATED',
              threadId: 'thread-1',
              actorUserId: 'user-a',
              recipientUserId: 'user-b',
              occurredAt: now.toISOString(),
            },
            readAt: null,
            createdAt: now.toISOString(),
          },
        },
        createdAt: now,
        publishAttempts: 1,
      },
    ]),
    notificationOutboxEvent: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('NotificationOutboxDispatcherService', () => {
  function createFixture(dispatcherEnabled = false) {
    const prisma = createPrismaMock();
    const publisher: PublisherMock = {
      isBound: vi.fn(() => true),
      publishNotificationCreated: vi.fn(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings({ dispatcherEnabled }),
      new ChatRealtimeMetricsService(),
    );
    return { dispatcher, prisma, publisher };
  }

  it.each([true, false])(
    'enabled=%s에 따라 timer를 등록하고 destroy 뒤에는 실행하지 않는다',
    async (enabled) => {
      vi.useFakeTimers();
      const { dispatcher, prisma, publisher } = createFixture(enabled);
      try {
        dispatcher.onApplicationBootstrap();
        expect(vi.getTimerCount()).toBe(enabled ? 1 : 0);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(enabled ? 1 : 0);
        expect(publisher.publishNotificationCreated).toHaveBeenCalledTimes(enabled ? 1 : 0);
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
      const { dispatcher, prisma, publisher } = createFixture(true);
      const error = new Error(`${failurePoint} unavailable`);
      if (failurePoint === 'clock') prisma.getDatabaseNow.mockRejectedValueOnce(error);
      else prisma.$queryRawTyped.mockRejectedValueOnce(error);
      try {
        dispatcher.onApplicationBootstrap();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(warn).toHaveBeenCalledOnce();
        expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(failurePoint === 'clock' ? 0 : 1);
        expect(publisher.publishNotificationCreated).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(2);
        expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(failurePoint === 'clock' ? 1 : 2);
        expect(publisher.publishNotificationCreated).toHaveBeenCalledOnce();
        expect(prisma.notificationOutboxEvent.update.mock.calls).toMatchObject([
          [{ data: { status: 'PUBLISHED' } }],
        ]);
        expect(warn).toHaveBeenCalledOnce();
      } finally {
        dispatcher.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        warn.mockRestore();
      }
    },
  );

  it('pending claim 중에는 두 번째 claim을 시작하지 않고 완료 뒤에는 다시 dispatch한다', async () => {
    const { dispatcher, prisma, publisher } = createFixture();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    prisma.$queryRawTyped.mockImplementationOnce(async () => {
      await pending;
      return [];
    });
    const now = new Date('2026-06-02T00:00:00.000Z');
    const first = dispatcher.dispatchOnce(now);
    try {
      expect(prisma.$queryRawTyped).toHaveBeenCalledOnce();
      await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
        claimedCount: 0,
        publishedCount: 0,
        failedCount: 0,
        skippedReason: null,
      });
      expect(prisma.$queryRawTyped).toHaveBeenCalledOnce();
      expect(publisher.publishNotificationCreated).not.toHaveBeenCalled();
      release();
      await expect(first).resolves.toMatchObject({ claimedCount: 0 });
      await expect(dispatcher.dispatchOnce(now)).resolves.toMatchObject({ publishedCount: 1 });
      expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(2);
      expect(publisher.publishNotificationCreated).toHaveBeenCalledOnce();
    } finally {
      release();
      await Promise.allSettled([first]);
      dispatcher.onModuleDestroy();
    }
  });

  it('publisher가 unbound이면 claim하지 않고 skip한다', async () => {
    const prisma = createPrismaMock();
    const metrics = new ChatRealtimeMetricsService();
    const now = new Date('2026-06-02T00:00:00.000Z');
    const publisher: PublisherMock = {
      isBound: vi.fn(() => false),
      publishNotificationCreated:
        vi.fn<(arg0: { recipientUserId: string; event: Record<string, unknown> }) => void>(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings(),
      metrics,
    );

    await expect(dispatcher.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      skippedReason: 'PUBLISHER_UNBOUND',
    });
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
    expect(metrics.snapshot().dispatchers.notification).toMatchObject({
      totalSkippedPublisherUnbound: 1,
      lastSkippedReason: 'PUBLISHER_UNBOUND',
      lastRunAt: now.toISOString(),
    });
  });

  it('claim된 notification.created를 recipient user room publisher에 전달하고 published로 전이한다', async () => {
    const prisma = createPrismaMock();
    const metrics = new ChatRealtimeMetricsService();
    const publisher: PublisherMock = {
      isBound: vi.fn(() => true),
      publishNotificationCreated:
        vi.fn<(arg0: { recipientUserId: string; event: Record<string, unknown> }) => void>(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings(),
      metrics,
    );

    await expect(dispatcher.dispatchOnce()).resolves.toMatchObject({
      claimedCount: 1,
      publishedCount: 1,
      failedCount: 0,
    });
    const [publishCall] = publisher.publishNotificationCreated.mock.calls;
    expect(publishCall?.[0].recipientUserId).toBe('user-b');
    expect(publishCall?.[0].event).toMatchObject({
      eventType: 'notification.created',
      eventId: 'notification-event-1',
      cursor: 'notification-event-1',
    });

    const [publishedUpdateCall] = prisma.notificationOutboxEvent.update.mock
      .calls as NotificationOutboxUpdateCall[];
    expect(publishedUpdateCall?.[0]).toMatchObject({
      where: { id: 'notification-event-1' },
      data: { status: 'PUBLISHED' },
    });
    expect(metrics.snapshot().dispatchers.notification).toMatchObject({
      totalClaimed: 1,
      totalPublished: 1,
      totalFailed: 0,
    });
  });

  it('unsafe payload는 publisher 호출 없이 failed/backoff로 전이한다', async () => {
    const metrics = new ChatRealtimeMetricsService();
    const prisma = createPrismaMock({
      notification: {
        id: 'notification-1',
        recipientUserId: 'user-b',
        actorUserId: 'user-a',
        kind: 'CHAT_THREAD_CREATED',
        sourceType: 'CONVERSATION_THREAD',
        sourceId: 'thread-1',
        payload: {
          kind: 'CHAT_THREAD_CREATED',
          threadId: 'thread-1',
          actorUserId: 'user-a',
          recipientUserId: 'user-b',
          occurredAt: '2026-06-02T00:00:00.000Z',
          retainedOriginalBody: '금지 payload',
        },
        readAt: null,
        createdAt: '2026-06-02T00:00:00.000Z',
      },
    });
    const publisher: PublisherMock = {
      isBound: vi.fn(() => true),
      publishNotificationCreated:
        vi.fn<(arg0: { recipientUserId: string; event: Record<string, unknown> }) => void>(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings(),
      metrics,
    );

    await expect(dispatcher.dispatchOnce()).resolves.toMatchObject({
      claimedCount: 1,
      publishedCount: 0,
      failedCount: 1,
    });
    expect(publisher.publishNotificationCreated).not.toHaveBeenCalled();
    const [failedUpdateCall] = prisma.notificationOutboxEvent.update.mock
      .calls as NotificationOutboxUpdateCall[];
    expect(failedUpdateCall?.[0].where).toEqual({ id: 'notification-event-1' });
    expect(failedUpdateCall?.[0].data.status).toBe('FAILED');
    expect(typeof failedUpdateCall?.[0].data.lastError).toBe('string');
    expect(metrics.snapshot().dispatchers.notification.totalFailed).toBe(1);
    expect(metrics.snapshot().publishFailures).toBe(1);
  });
});

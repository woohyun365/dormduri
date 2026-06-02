import { NotificationOutboxDispatcherService } from './notification-dispatcher.service.js';

type PublisherMock = {
  isBound: jest.Mock<boolean, []>;
  publishNotificationCreated: jest.Mock<
    void,
    [{ recipientUserId: string; event: Record<string, unknown> }]
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
    getDatabaseNow: jest.fn().mockResolvedValue(now),
    $queryRawTyped: jest.fn().mockResolvedValue([
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
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('NotificationOutboxDispatcherService', () => {
  it('publisher가 unbound이면 claim하지 않고 skip한다', async () => {
    const prisma = createPrismaMock();
    const publisher: PublisherMock = {
      isBound: jest.fn(() => false),
      publishNotificationCreated: jest.fn<
        void,
        [{ recipientUserId: string; event: Record<string, unknown> }]
      >(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings() as never,
    );

    await expect(dispatcher.dispatchOnce()).resolves.toEqual({
      claimedCount: 0,
      publishedCount: 0,
      failedCount: 0,
      skippedReason: 'PUBLISHER_UNBOUND',
    });
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('claim된 notification.created를 recipient user room publisher에 전달하고 published로 전이한다', async () => {
    const prisma = createPrismaMock();
    const publisher: PublisherMock = {
      isBound: jest.fn(() => true),
      publishNotificationCreated: jest.fn<
        void,
        [{ recipientUserId: string; event: Record<string, unknown> }]
      >(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings() as never,
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
  });

  it('publisher 실패나 unsafe payload는 failed/backoff로 전이한다', async () => {
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
      isBound: jest.fn(() => true),
      publishNotificationCreated: jest.fn<
        void,
        [{ recipientUserId: string; event: Record<string, unknown> }]
      >(),
    };
    const dispatcher = new NotificationOutboxDispatcherService(
      prisma as never,
      publisher,
      createSettings() as never,
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
  });
});

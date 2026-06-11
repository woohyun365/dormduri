import { CreateNotificationCommand } from './create-notification.command.js';

type TxMock = {
  userNotification: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  notificationOutboxEvent: {
    create: jest.Mock;
  };
};

type UserNotificationCreateCall = [
  {
    data: {
      recipientUserId: string;
      actorUserId: string;
      kind: string;
      sourceType: string;
      sourceId: string;
      payload: unknown;
    };
  },
];

type NotificationOutboxCreateCall = [
  {
    data: {
      notificationId: string;
      recipientUserId: string;
      eventType: string;
      status: string;
      payload: {
        notification?: {
          id?: string;
          kind?: string;
          sourceType?: string;
          sourceId?: string;
        };
      };
    };
  },
];

const occurredAt = new Date('2026-06-02T00:00:00.000Z');

function createTxMock(): TxMock {
  return {
    userNotification: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
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
          occurredAt: occurredAt.toISOString(),
        },
        readAt: null,
        createdAt: occurredAt,
      }),
    },
    notificationOutboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'notification-event-1' }),
    },
  };
}

function appendInput() {
  return {
    recipientUserId: 'user-b',
    actorUserId: 'user-a',
    kind: 'CHAT_THREAD_CREATED' as const,
    sourceType: 'CONVERSATION_THREAD' as const,
    sourceId: 'thread-1',
    payload: {
      kind: 'CHAT_THREAD_CREATED' as const,
      threadId: 'thread-1',
      actorUserId: 'user-a',
      recipientUserId: 'user-b',
      occurredAt: occurredAt.toISOString(),
    },
    occurredAt,
  };
}

describe('CreateNotificationCommand', () => {
  it('generic notification과 outbox event를 같은 tx client에 append한다', async () => {
    const command = new CreateNotificationCommand();
    const tx = createTxMock();

    await expect(command.appendNotification(tx as never, appendInput())).resolves.toEqual({
      notificationId: 'notification-1',
      created: true,
    });

    const [notificationCreateCall] = tx.userNotification.create.mock
      .calls as UserNotificationCreateCall[];
    expect(notificationCreateCall?.[0].data).toMatchObject({
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
        occurredAt: occurredAt.toISOString(),
      },
    });

    const [outboxCreateCall] = tx.notificationOutboxEvent.create.mock
      .calls as NotificationOutboxCreateCall[];
    expect(outboxCreateCall?.[0].data).toMatchObject({
      notificationId: 'notification-1',
      recipientUserId: 'user-b',
      eventType: 'notification.created',
      status: 'PENDING',
    });
    expect(outboxCreateCall?.[0].data.payload.notification).toMatchObject({
      id: 'notification-1',
      kind: 'CHAT_THREAD_CREATED',
      sourceType: 'CONVERSATION_THREAD',
      sourceId: 'thread-1',
    });
  });

  it('기존 source notification이 있으면 duplicate retry에서 outbox를 추가하지 않는다', async () => {
    const command = new CreateNotificationCommand();
    const tx = createTxMock();
    tx.userNotification.findUnique.mockResolvedValueOnce({ id: 'notification-existing' });

    await expect(command.appendNotification(tx as never, appendInput())).resolves.toEqual({
      notificationId: 'notification-existing',
      created: false,
    });

    expect(tx.userNotification.create).not.toHaveBeenCalled();
    expect(tx.notificationOutboxEvent.create).not.toHaveBeenCalled();
  });

  it('forbidden payload key는 persistence 전에 거절한다', async () => {
    const command = new CreateNotificationCommand();
    const tx = createTxMock();

    await expect(
      command.appendNotification(tx as never, {
        ...appendInput(),
        payload: { ...appendInput().payload, reportDetail: 'raw report detail' } as never,
      }),
    ).rejects.toThrow(/forbidden payload key/);

    expect(tx.userNotification.findUnique).not.toHaveBeenCalled();
    expect(tx.userNotification.create).not.toHaveBeenCalled();
  });
});

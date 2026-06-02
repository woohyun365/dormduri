import { CreateChatThreadNotificationCommand } from './create-chat-thread-notification.command.js';

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
          occurredAt: '2026-06-02T00:00:00.000Z',
        },
        readAt: null,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
    },
    notificationOutboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'notification-event-1' }),
    },
  };
}

describe('CreateChatThreadNotificationCommand', () => {
  it('새 direct thread 생성 알림과 outbox event를 같은 tx client에 append한다', async () => {
    const command = new CreateChatThreadNotificationCommand();
    const tx = createTxMock();
    const occurredAt = new Date('2026-06-02T00:00:00.000Z');

    await expect(
      command.appendChatThreadCreated(tx as never, {
        threadId: 'thread-1',
        actorUserId: 'user-a',
        recipientUserId: 'user-b',
        occurredAt,
      }),
    ).resolves.toEqual({ notificationId: 'notification-1', created: true });

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
        occurredAt: '2026-06-02T00:00:00.000Z',
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
    const command = new CreateChatThreadNotificationCommand();
    const tx = createTxMock();
    tx.userNotification.findUnique.mockResolvedValueOnce({ id: 'notification-existing' });

    await expect(
      command.appendChatThreadCreated(tx as never, {
        threadId: 'thread-1',
        actorUserId: 'user-a',
        recipientUserId: 'user-b',
        occurredAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ notificationId: 'notification-existing', created: false });

    expect(tx.userNotification.create).not.toHaveBeenCalled();
    expect(tx.notificationOutboxEvent.create).not.toHaveBeenCalled();
  });

  it('sender 자신에게는 알림을 만들지 않는다', async () => {
    const command = new CreateChatThreadNotificationCommand();
    const tx = createTxMock();

    await expect(
      command.appendChatThreadCreated(tx as never, {
        threadId: 'thread-1',
        actorUserId: 'user-a',
        recipientUserId: 'user-a',
        occurredAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ notificationId: '', created: false });

    expect(tx.userNotification.findUnique).not.toHaveBeenCalled();
    expect(tx.userNotification.create).not.toHaveBeenCalled();
    expect(tx.notificationOutboxEvent.create).not.toHaveBeenCalled();
  });
});

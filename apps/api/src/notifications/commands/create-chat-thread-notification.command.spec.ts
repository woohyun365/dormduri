import { describe, expect, it, vi, type Mocked } from 'vitest';
import { CreateChatThreadNotificationCommand } from './create-chat-thread-notification.command.js';
import type { NotificationWriterPort } from '../application/ports/notification-writer.port.js';

const occurredAt = new Date('2026-06-02T00:00:00.000Z');

function createWriterMock(): Mocked<NotificationWriterPort> {
  return {
    appendNotification: vi
      .fn()
      .mockResolvedValue({ notificationId: 'notification-1', created: true }),
  };
}

describe('CreateChatThreadNotificationCommand', () => {
  it('채팅방 생성 알림을 generic notification writer로 위임한다', async () => {
    const writer = createWriterMock();
    const command = new CreateChatThreadNotificationCommand(writer);
    const tx = { tx: true } as never;

    await expect(
      command.appendChatThreadCreated(tx, {
        threadId: 'thread-1',
        actorUserId: 'user-a',
        recipientUserId: 'user-b',
        occurredAt,
      }),
    ).resolves.toEqual({ notificationId: 'notification-1', created: true });

    expect(writer.appendNotification.mock.calls).toEqual([
      [
        tx,
        {
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
          occurredAt,
        },
      ],
    ]);
  });

  it('sender 자신에게는 generic writer를 호출하지 않는다', async () => {
    const writer = createWriterMock();
    const command = new CreateChatThreadNotificationCommand(writer);

    await expect(
      command.appendChatThreadCreated({} as never, {
        threadId: 'thread-1',
        actorUserId: 'user-a',
        recipientUserId: 'user-a',
        occurredAt,
      }),
    ).resolves.toEqual({ notificationId: '', created: false });

    expect(writer.appendNotification.mock.calls).toEqual([]);
  });
});

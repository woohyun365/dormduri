import { createNotificationListCursorOwner } from './notification-list-cursor.js';
import { NotificationQueryService } from './notification-query.service.js';

const now = new Date('2026-06-02T00:00:00.000Z');

function createPrismaMock() {
  return {
    getDatabaseNow: jest.fn().mockResolvedValue(now),
    userNotification: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

function notificationRecord(id: string, createdAt = now) {
  return {
    id,
    recipientUserId: 'user-b',
    actorUserId: 'user-a',
    kind: 'CHAT_THREAD_CREATED' as const,
    sourceType: 'CONVERSATION_THREAD',
    sourceId: 'thread-1',
    payload: {
      kind: 'CHAT_THREAD_CREATED' as const,
      threadId: 'thread-1',
      actorUserId: 'user-a',
      recipientUserId: 'user-b',
      occurredAt: now.toISOString(),
    },
    readAt: null,
    createdAt,
  };
}

describe('NotificationQueryService', () => {
  it('listNotifications는 authenticated recipient scope와 limit+1 pagination을 사용한다', async () => {
    const prisma = createPrismaMock();
    prisma.userNotification.findMany.mockResolvedValueOnce([
      notificationRecord('notification-2', new Date('2026-06-02T00:00:02.000Z')),
      notificationRecord('notification-1', new Date('2026-06-02T00:00:01.000Z')),
    ]);
    const service = new NotificationQueryService(prisma as never);

    const result = await service.listNotifications('user-b', { limit: 1 });
    expect(result.items).toEqual([expect.objectContaining({ id: 'notification-2' })]);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(typeof result.pageInfo.nextCursor).toBe('string');
    expect(prisma.userNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: 'user-b' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
    );
  });

  it('cursor viewer mismatch는 invalid cursor error로 거절한다', async () => {
    const prisma = createPrismaMock();
    const cursor = createNotificationListCursorOwner().signCursor({
      viewerUserId: 'user-a',
      after: { createdAt: now, notificationId: 'notification-1' },
      now,
    });
    const service = new NotificationQueryService(prisma as never);

    await expect(service.listNotifications('user-b', { cursor })).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_LIST_CURSOR_INVALID' },
    });
    expect(prisma.userNotification.findMany).not.toHaveBeenCalled();
  });

  it('markAllRead는 recipient unread 알림만 bounded update한다', async () => {
    const prisma = createPrismaMock();
    prisma.userNotification.updateMany.mockResolvedValueOnce({ count: 2 });
    const service = new NotificationQueryService(prisma as never);

    await expect(service.markAllRead('user-b')).resolves.toEqual({
      updatedCount: 2,
      readAt: now.toISOString(),
    });
    expect(prisma.userNotification.updateMany).toHaveBeenCalledWith({
      where: { recipientUserId: 'user-b', readAt: null },
      data: { readAt: now, updatedAt: now },
    });
  });

  it('markRead는 recipient 소유 알림만 idempotent하게 읽음 처리한다', async () => {
    const prisma = createPrismaMock();
    prisma.userNotification.findFirst.mockResolvedValueOnce({
      ...notificationRecord('notification-1'),
      readAt: now,
    });
    const service = new NotificationQueryService(prisma as never);

    await expect(service.markRead('user-b', 'notification-1')).resolves.toMatchObject({
      notification: { id: 'notification-1', readAt: now.toISOString() },
    });
    expect(prisma.userNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-1', recipientUserId: 'user-b', readAt: null },
      data: { readAt: now, updatedAt: now },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { createNotificationListCursorOwner } from './notification-list-cursor.js';

describe('createNotificationListCursorOwner', () => {
  it('viewer scope와 TTL이 맞는 cursor만 boundary로 복원한다', () => {
    const owner = createNotificationListCursorOwner('secret');
    const now = new Date('2026-06-02T00:00:00.000Z');
    const cursor = owner.signCursor({
      viewerUserId: 'user-a',
      after: {
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        notificationId: 'notification-1',
      },
      now,
    });

    expect(owner.verifyCursor({ cursor, viewerUserId: 'user-a', now })).toEqual({
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      notificationId: 'notification-1',
    });
    expect(() => owner.verifyCursor({ cursor, viewerUserId: 'user-b', now })).toThrow();
    expect(() =>
      owner.verifyCursor({
        cursor,
        viewerUserId: 'user-a',
        now: new Date('2026-06-02T00:11:00.000Z'),
      }),
    ).toThrow();
  });
});

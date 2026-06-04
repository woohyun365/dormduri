import { OpaqueTokenError } from '../../platform/security/opaque-hmac-token.js';
import {
  buildChatThreadListCursorBoundary,
  createChatThreadListCursorOwner,
} from './chat-thread-list-cursor.js';

describe('ChatThreadListCursorOwner', () => {
  const now = new Date('2026-02-10T03:00:00.000Z');
  const owner = createChatThreadListCursorOwner('test-secret');

  it('viewer와 boundary를 묶은 opaque cursor를 발급하고 검증한다', () => {
    const cursor = owner.signCursor({
      viewerUserId: 'user-1',
      now,
      after: {
        lastMessageAt: new Date('2026-02-10T02:00:00.000Z'),
        createdAt: new Date('2026-02-09T02:00:00.000Z'),
        threadId: 'thread-1',
      },
    });

    expect(owner.verifyCursor({ cursor, viewerUserId: 'user-1', now })).toEqual({
      lastMessageAt: new Date('2026-02-10T02:00:00.000Z'),
      createdAt: new Date('2026-02-09T02:00:00.000Z'),
      threadId: 'thread-1',
    });
  });

  it('다른 viewer 또는 만료 cursor는 거절한다', () => {
    const cursor = owner.signCursor({
      viewerUserId: 'user-1',
      now,
      after: {
        lastMessageAt: null,
        createdAt: new Date('2026-02-09T02:00:00.000Z'),
        threadId: 'thread-1',
      },
    });

    expect(() => owner.verifyCursor({ cursor, viewerUserId: 'user-2', now })).toThrow(
      OpaqueTokenError,
    );
    expect(() =>
      owner.verifyCursor({
        cursor,
        viewerUserId: 'user-1',
        now: new Date('2026-02-10T03:11:00.000Z'),
      }),
    ).toThrow(OpaqueTokenError);
  });

  it('thread row에서 deterministic cursor boundary를 만든다', () => {
    expect(
      buildChatThreadListCursorBoundary({
        id: 'thread-1',
        lastMessageAt: null,
        createdAt: new Date('2026-02-09T02:00:00.000Z'),
      }),
    ).toEqual({
      lastMessageAt: null,
      createdAt: new Date('2026-02-09T02:00:00.000Z'),
      threadId: 'thread-1',
    });
  });
});

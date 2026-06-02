import {
  assertNotificationPayloadAllowed,
  isNotificationPayloadPrivacySafe,
  toChatThreadCreatedNotificationPayload,
} from './notification-payload.policy.js';

describe('notification payload policy', () => {
  it('채팅방 생성 알림은 allowlist payload만 생성한다', () => {
    expect(
      toChatThreadCreatedNotificationPayload({
        threadId: 'thread-1',
        actorUserId: 'user-a',
        recipientUserId: 'user-b',
        occurredAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
    ).toEqual({
      kind: 'CHAT_THREAD_CREATED',
      threadId: 'thread-1',
      actorUserId: 'user-a',
      recipientUserId: 'user-b',
      occurredAt: '2026-06-02T00:00:00.000Z',
    });
  });

  it('message body / retained payload / full identity key는 거절한다', () => {
    expect(() => assertNotificationPayloadAllowed({ body: '원문' })).toThrow(
      /forbidden payload key/,
    );
    expect(() =>
      assertNotificationPayloadAllowed({ nested: { retainedOriginalBody: 'retained 원문' } }),
    ).toThrow(/forbidden payload key/);
    expect(
      isNotificationPayloadPrivacySafe({ user: { displayIdentity: { nickname: '닉네임' } } }),
    ).toBe(false);
  });
});

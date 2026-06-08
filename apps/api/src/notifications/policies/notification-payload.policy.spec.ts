import {
  assertNotificationPayloadAllowed,
  isNotificationPayloadPrivacySafe,
  toChatThreadCreatedNotificationPayload,
  toReportReceivedNotificationPayload,
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

  it('신고 접수 알림은 report pointer와 RECEIVED 상태만 포함한다', () => {
    expect(
      toReportReceivedNotificationPayload({
        reportId: 'report-1',
        occurredAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
    ).toEqual({
      kind: 'REPORT_RECEIVED',
      reportId: 'report-1',
      status: 'RECEIVED',
      occurredAt: '2026-06-02T00:00:00.000Z',
    });
  });

  it('message body / report detail / block note / support body / retained payload / full identity key는 거절한다', () => {
    expect(() => assertNotificationPayloadAllowed({ body: '원문' })).toThrow(
      /forbidden payload key/,
    );
    expect(() =>
      assertNotificationPayloadAllowed({ nested: { retainedOriginalBody: 'retained 원문' } }),
    ).toThrow(/forbidden payload key/);
    expect(() => assertNotificationPayloadAllowed({ reportDetail: '신고 상세' })).toThrow(
      /forbidden payload key/,
    );
    expect(() => assertNotificationPayloadAllowed({ blockNote: '차단 메모' })).toThrow(
      /forbidden payload key/,
    );
    expect(() => assertNotificationPayloadAllowed({ supportBody: '문의 본문' })).toThrow(
      /forbidden payload key/,
    );
    expect(
      isNotificationPayloadPrivacySafe({ user: { displayIdentity: { nickname: '닉네임' } } }),
    ).toBe(false);
  });
});

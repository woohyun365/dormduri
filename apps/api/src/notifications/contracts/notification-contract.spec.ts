import { describe, expect, it } from 'vitest';
import * as chatRealtimeEvents from '@repo/shared/chat/realtime-events';
import * as notificationContract from '@repo/shared/notifications';

describe('notification shared contract guards', () => {
  const occurredAt = '2026-06-02T00:00:00.000Z';

  it('notification package exports는 notification schema surface를 제공한다', () => {
    expect(typeof notificationContract.userNotificationSchema.parse).toBe('function');
    expect(typeof notificationContract.notificationListResponseSchema.parse).toBe('function');
    expect(typeof notificationContract.notificationCreatedRealtimeEventSchema.parse).toBe(
      'function',
    );
  });

  it('채팅방 생성 알림 payload는 allowlist 식별자만 허용한다', () => {
    const notification = {
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
        occurredAt,
      },
      readAt: null,
      createdAt: occurredAt,
    };

    expect(notificationContract.userNotificationSchema.safeParse(notification).success).toBe(true);
    expect(
      notificationContract.userNotificationSchema.safeParse({
        ...notification,
        payload: {
          ...notification.payload,
          body: '알림에 들어가면 안 되는 메시지 본문',
        },
      }).success,
    ).toBe(false);
    expect(
      notificationContract.userNotificationSchema.safeParse({
        ...notification,
        payload: {
          ...notification.payload,
          nickname: '표시명도 payload에 저장하지 않는다',
        },
      }).success,
    ).toBe(false);
  });

  it('profile mismatch feedback과 read-all response contract를 허용한다', () => {
    expect(
      notificationContract.userNotificationSchema.safeParse({
        id: 'notification-profile-feedback-1',
        recipientUserId: 'target-user',
        actorUserId: 'target-user',
        kind: 'PROFILE_MISMATCH_FEEDBACK',
        sourceType: 'REPORT_CASE',
        sourceId: 'report-1',
        payload: {
          kind: 'PROFILE_MISMATCH_FEEDBACK',
          reportId: 'report-1',
          promptCode: 'PROFILE_REVIEW_NEXT_SEASON',
          occurredAt,
        },
        readAt: null,
        createdAt: occurredAt,
      }).success,
    ).toBe(true);

    expect(
      notificationContract.userNotificationSchema.safeParse({
        id: 'notification-profile-feedback-1',
        recipientUserId: 'target-user',
        actorUserId: 'target-user',
        kind: 'PROFILE_MISMATCH_FEEDBACK',
        sourceType: 'REPORT_CASE',
        sourceId: 'report-1',
        payload: {
          kind: 'PROFILE_MISMATCH_FEEDBACK',
          reportId: 'report-1',
          promptCode: 'PROFILE_REVIEW_NEXT_SEASON',
          reporterUserId: 'reporter-user',
          reportDetail: 'raw report detail',
          occurredAt,
        },
        readAt: null,
        createdAt: occurredAt,
      }).success,
    ).toBe(false);

    expect(
      notificationContract.markAllNotificationsReadResponseSchema.parse({
        updatedCount: 2,
        readAt: occurredAt,
      }),
    ).toEqual({ updatedCount: 2, readAt: occurredAt });
  });

  it('matching notification payload는 request/active match pointer만 허용한다', () => {
    expect(
      notificationContract.userNotificationSchema.safeParse({
        id: 'notification-match-request-1',
        recipientUserId: 'receiver-user',
        actorUserId: 'requester-user',
        kind: 'MATCH_REQUEST_RECEIVED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'match-request-1',
        payload: {
          kind: 'MATCH_REQUEST_RECEIVED',
          matchRequestId: 'match-request-1',
          seasonId: 'season-2026-02',
          occurredAt,
        },
        readAt: null,
        createdAt: occurredAt,
      }).success,
    ).toBe(true);

    expect(
      notificationContract.userNotificationSchema.safeParse({
        id: 'notification-match-success-1',
        recipientUserId: 'matched-user',
        actorUserId: 'counterpart-user',
        kind: 'ACTIVE_MATCH_CREATED',
        sourceType: 'ACTIVE_MATCH',
        sourceId: 'active-match-1',
        payload: {
          kind: 'ACTIVE_MATCH_CREATED',
          activeMatchId: 'active-match-1',
          seasonId: 'season-2026-02',
          occurredAt,
        },
        readAt: null,
        createdAt: occurredAt,
      }).success,
    ).toBe(true);

    expect(
      notificationContract.userNotificationSchema.safeParse({
        id: 'notification-match-request-raw-1',
        recipientUserId: 'receiver-user',
        actorUserId: 'requester-user',
        kind: 'MATCH_REQUEST_RECEIVED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'match-request-1',
        payload: {
          kind: 'MATCH_REQUEST_RECEIVED',
          matchRequestId: 'match-request-1',
          seasonId: 'season-2026-02',
          nickname: '알림 payload에 저장하지 않는 닉네임',
          occurredAt,
        },
        readAt: null,
        createdAt: occurredAt,
      }).success,
    ).toBe(false);
  });

  it('support notification payload는 support body/email 같은 raw field를 허용하지 않는다', () => {
    expect(
      notificationContract.notificationPayloadSchema.parse({
        kind: 'SUPPORT_TICKET_REPLIED',
        supportTicketId: 'support-1',
        status: 'RESOLVED',
        occurredAt,
      }),
    ).toMatchObject({ kind: 'SUPPORT_TICKET_REPLIED', supportTicketId: 'support-1' });

    expect(() =>
      notificationContract.notificationPayloadSchema.parse({
        kind: 'SUPPORT_TICKET_REPLIED',
        supportTicketId: 'support-1',
        status: 'RESOLVED',
        occurredAt,
        supportBody: 'raw body',
      }),
    ).toThrow();

    expect(() =>
      notificationContract.notificationPayloadSchema.parse({
        kind: 'SUPPORT_TICKET_CREATED',
        supportTicketId: 'support-1',
        category: 'APPEAL',
        status: 'OPEN',
        occurredAt,
        email: 'user@example.com',
      }),
    ).toThrow();
  });

  it('notification.created realtime event는 chat realtime event union에 포함된다', () => {
    const event = {
      schemaVersion: 1,
      eventId: 'notification-event-1',
      eventType: 'notification.created',
      occurredAt,
      cursor: 'notification-event-1',
      payload: {
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
            occurredAt,
          },
          readAt: null,
          createdAt: occurredAt,
        },
      },
    };

    expect(
      notificationContract.notificationCreatedRealtimeEventSchema.safeParse(event).success,
    ).toBe(true);
    expect(chatRealtimeEvents.chatRealtimeEventSchema.safeParse(event).success).toBe(true);
  });
});

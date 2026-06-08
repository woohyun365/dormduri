import * as chatContract from '@repo/shared/chat-contract';
import * as chatRealtimeEvents from '@repo/shared/chat-realtime-events';
import * as notificationContract from '@repo/shared/notification-contract';

describe('notification shared contract guards', () => {
  const occurredAt = '2026-06-02T00:00:00.000Z';

  it('notification package exports는 chat-contract 통합 export와 같은 schema surface를 제공한다', () => {
    expect(notificationContract.userNotificationSchema).toBe(chatContract.userNotificationSchema);
    expect(notificationContract.notificationListResponseSchema).toBe(
      chatContract.notificationListResponseSchema,
    );
    expect(notificationContract.notificationCreatedRealtimeEventSchema).toBe(
      chatContract.notificationCreatedRealtimeEventSchema,
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

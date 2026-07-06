import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationsPageApi, NotificationsPageFetchError } from '../api/notifications-page.api';

const iso = '2026-07-03T00:00:00.000Z';

function stubFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': contentType } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function notification() {
  return {
    id: 'notification-1',
    recipientUserId: 'user-1',
    actorUserId: 'system',
    kind: 'SUPPORT_TICKET_REPLIED',
    sourceType: 'SUPPORT_TICKET',
    sourceId: 'ticket-1',
    payload: {
      kind: 'SUPPORT_TICKET_REPLIED',
      supportTicketId: 'ticket-1',
      status: 'WAITING_USER',
      occurredAt: iso,
    },
    readAt: null,
    createdAt: iso,
  };
}

describe('notificationsPageApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('알림 목록과 unread count를 BFF route에서 읽는다', async () => {
    const fetchMock = stubFetch({
      items: [notification()],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    await expect(notificationsPageApi.listNotifications({ limit: 50 })).resolves.toMatchObject({
      items: [{ id: 'notification-1' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications?limit=50',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('schema mismatch는 typed error로 수렴한다', async () => {
    stubFetch({ items: [{ rawSupportBody: 'must-not-leak' }] });

    await expect(notificationsPageApi.listNotifications()).rejects.toMatchObject({
      name: 'NotificationsPageFetchError',
      code: 'NOTIFICATIONS_UPSTREAM_INVALID',
      message: 'Notification response did not match the public contract.',
    } satisfies Partial<NotificationsPageFetchError>);
  });
});

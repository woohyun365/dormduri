import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { GET as getBookmarks } from '../bookmarks/route';
import {
  DELETE as deleteBookmark,
  POST as createBookmark,
} from '../bookmarks/[targetUserId]/route';
import { GET as listBlocks } from '../blocks/route';
import { DELETE as deleteBlock, POST as createBlock } from '../blocks/[targetUserId]/route';
import { GET as listReports, POST as createReport } from '../reports/route';
import { GET as listSupportFaq } from '../support/faq/route';
import { GET as getSupportFaq } from '../support/faq/[articleId]/route';
import { GET as listSupportTickets, POST as createSupportTicket } from '../support/tickets/route';
import { GET as getSupportTicket } from '../support/tickets/[ticketId]/route';
import { POST as appendSupportTicketMessage } from '../support/tickets/[ticketId]/messages/route';
import { GET as listNotifications } from '../notifications/route';
import { GET as getNotificationUnreadCount } from '../notifications/unread-count/route';
import { POST as markAllNotificationsRead } from '../notifications/read-all/route';
import { POST as markNotificationRead } from '../notifications/[notificationId]/read/route';

const AUTH_TOKEN = `v1.session-social-safety.${'a'.repeat(43)}`;

describe('social-safety/support/notification BFF forwarding routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bookmark list는 query와 opaque auth cookie를 upstream API로 전달한다', async () => {
    const fetchMock = stubJsonFetch({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      emptyState: { code: 'NO_BOOKMARKS' },
      sort: 'MATCH_SCORE',
      serverTime: '2026-06-08T00:00:00.000Z',
    });
    const request = createRequest('/api/bookmarks?sort=MATCH_SCORE&cursor=c1&limit=10', {
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
    });

    const response = await getBookmarks(request);

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/bookmarks?sort=MATCH_SCORE&cursor=c1&limit=10',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'vitest',
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ sort: 'MATCH_SCORE' });
  });

  it('bookmark target routes는 path segment를 encode하고 body를 만들지 않는다', async () => {
    const createFetchMock = stubJsonFetch({ created: true });
    const createRequestInput = createRequest('/api/bookmarks/user%201%2F2', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const createResponse = await createBookmark(createRequestInput, {
      params: { targetUserId: 'user 1/2' },
    });

    expect(firstFetchInput(createFetchMock)).toBe(
      'http://localhost:4000/api/bookmarks/user%201%2F2',
    );
    expect(firstFetchInit(createFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(createFetchMock)).not.toHaveProperty('body');
    await expect(createResponse.json()).resolves.toEqual({ created: true });

    vi.unstubAllGlobals();
    const deleteFetchMock = stubJsonFetch({ deleted: true });
    const deleteRequestInput = createRequest('/api/bookmarks/user%201%2F2', {
      method: 'DELETE',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await deleteBookmark(deleteRequestInput, { params: { targetUserId: 'user 1/2' } });

    expect(firstFetchInput(deleteFetchMock)).toBe(
      'http://localhost:4000/api/bookmarks/user%201%2F2',
    );
    expect(firstFetchInit(deleteFetchMock)).toEqual(
      expect.objectContaining({
        method: 'DELETE',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(deleteFetchMock)).not.toHaveProperty('body');
  });

  it('block list/create/delete는 query, optional body, target path를 그대로 전달한다', async () => {
    const listFetchMock = stubJsonFetch({ items: [] });
    const listRequestInput = createRequest('/api/blocks?cursor=c1&limit=20', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await listBlocks(listRequestInput);

    expect(firstFetchInput(listFetchMock)).toBe(
      'http://localhost:4000/api/blocks?cursor=c1&limit=20',
    );
    expect(firstFetchInit(listFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const fetchMock = stubJsonFetch({ created: true });
    const request = createRequest('/api/blocks/target-1', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: '다시 매칭하고 싶지 않음' }),
    });

    await createBlock(request, { params: Promise.resolve({ targetUserId: 'target-1' }) });

    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/blocks/target-1');
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ note: '다시 매칭하고 싶지 않음' }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        }),
      }),
    );

    vi.unstubAllGlobals();
    const deleteFetchMock = stubJsonFetch({ deleted: true });
    const deleteRequestInput = createRequest('/api/blocks/target-1', {
      method: 'DELETE',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await deleteBlock(deleteRequestInput, { params: { targetUserId: 'target-1' } });

    expect(firstFetchInput(deleteFetchMock)).toBe('http://localhost:4000/api/blocks/target-1');
    expect(firstFetchInit(deleteFetchMock)).toEqual(
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(deleteFetchMock)).not.toHaveProperty('body');
  });

  it('report BFF는 내 신고 내역 query와 intake body만 전달하고 operations/decision route를 만들지 않는다', async () => {
    const listFetchMock = stubJsonFetch({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    const listRequest = createRequest('/api/reports?limit=10&cursor=c1&ignored=1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await listReports(listRequest);

    expect(firstFetchInput(listFetchMock)).toBe(
      'http://localhost:4000/api/reports?limit=10&cursor=c1&ignored=1',
    );
    expect(firstFetchInit(listFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const fetchMock = stubJsonFetch({ received: true });
    const body = {
      targetType: 'PROFILE',
      targetId: 'target-1',
      reason: 'FALSE_PROFILE',
      falseReportDisclaimerAccepted: true,
    };
    const request = createRequest('/api/reports', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    await createReport(request);

    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/reports');
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(existsSync(join(process.cwd(), 'src/app/api/operations/reports'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/app/api/reports/[reportId]'))).toBe(false);
  });

  it('support FAQ list/detail은 public route라 auth cookie가 있어도 Authorization을 전달하지 않는다', async () => {
    const fetchMock = stubJsonFetch({ items: [] });
    const request = createRequest('/api/support/faq?category=ACCOUNT&surface=LANDING&ignored=1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await listSupportFaq(request);

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/support/faq?category=ACCOUNT&surface=LANDING',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );

    vi.unstubAllGlobals();
    const invalidFetchMock = stubJsonFetch({ shouldNotForward: true });
    const invalidRequest = createRequest('/api/support/faq?surface=UNKNOWN', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const invalidResponse = await listSupportFaq(invalidRequest);

    expect(invalidFetchMock).not.toHaveBeenCalled();
    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      success: false,
      code: 'INVALID_SUPPORT_FAQ_QUERY',
    });

    vi.unstubAllGlobals();
    const detailFetchMock = stubJsonFetch({ item: { id: 'faq-1' } });
    const detailRequest = createRequest('/api/support/faq/faq-1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await getSupportFaq(detailRequest, { params: { articleId: 'faq-1' } });

    expect(firstFetchInput(detailFetchMock)).toBe('http://localhost:4000/api/support/faq/faq-1');
    expect(firstFetchInit(detailFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
  });

  it('support ticket routes는 protected forwarding으로 query/body/path를 전달한다', async () => {
    const listFetchMock = stubJsonFetch({ items: [] });
    const listRequest = createRequest('/api/support/tickets?status=OPEN&cursor=c1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await listSupportTickets(listRequest);

    expect(firstFetchInput(listFetchMock)).toBe(
      'http://localhost:4000/api/support/tickets?status=OPEN&cursor=c1',
    );
    expect(firstFetchInit(listFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const createFetchMock = stubJsonFetch({ ticket: { id: 'ticket-1' } });
    const createTicketRequest = createRequest('/api/support/tickets', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ category: 'BUG', subject: '버그', body: '재현됩니다.' }),
    });

    await createSupportTicket(createTicketRequest);

    expect(firstFetchInput(createFetchMock)).toBe('http://localhost:4000/api/support/tickets');
    expect(firstFetchInit(createFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ category: 'BUG', subject: '버그', body: '재현됩니다.' }),
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const detailFetchMock = stubJsonFetch({ ticket: { id: 'ticket-1' } });
    const detailRequest = createRequest('/api/support/tickets/ticket-1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await getSupportTicket(detailRequest, { params: { ticketId: 'ticket-1' } });

    expect(firstFetchInput(detailFetchMock)).toBe(
      'http://localhost:4000/api/support/tickets/ticket-1',
    );
    expect(firstFetchInit(detailFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const fetchMock = stubJsonFetch({ message: { id: 'message-1' } });
    const request = createRequest('/api/support/tickets/ticket-1/messages', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: '추가 문의입니다.' }),
    });

    await appendSupportTicketMessage(request, { params: { ticketId: 'ticket-1' } });

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/support/tickets/ticket-1/messages',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: '추가 문의입니다.' }),
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(existsSync(join(process.cwd(), 'src/app/api/operations/support'))).toBe(false);
  });

  it('notification routes는 protected forwarding으로 list/unread/read-all/single-read를 전달한다', async () => {
    const listFetchMock = stubJsonFetch({ items: [] });
    const listRequest = createRequest('/api/notifications?limit=30&cursor=c1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await listNotifications(listRequest);

    expect(firstFetchInput(listFetchMock)).toBe(
      'http://localhost:4000/api/notifications?limit=30&cursor=c1',
    );
    expect(firstFetchInit(listFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const unreadFetchMock = stubJsonFetch({ unreadCount: 2 });
    const unreadRequest = createRequest('/api/notifications/unread-count', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await getNotificationUnreadCount(unreadRequest);

    expect(firstFetchInput(unreadFetchMock)).toBe(
      'http://localhost:4000/api/notifications/unread-count',
    );
    expect(firstFetchInit(unreadFetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const readAllFetchMock = stubJsonFetch({
      updatedCount: 2,
      readAt: '2026-06-08T00:00:00.000Z',
    });
    const readAllRequest = createRequest('/api/notifications/read-all', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await markAllNotificationsRead(readAllRequest);

    expect(firstFetchInput(readAllFetchMock)).toBe(
      'http://localhost:4000/api/notifications/read-all',
    );
    expect(firstFetchInit(readAllFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const singleReadFetchMock = stubJsonFetch({ notification: { id: 'notification-1' } });
    const singleReadRequest = createRequest('/api/notifications/notification-1/read', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await markNotificationRead(singleReadRequest, { params: { notificationId: 'notification-1' } });

    expect(firstFetchInput(singleReadFetchMock)).toBe(
      'http://localhost:4000/api/notifications/notification-1/read',
    );
    expect(firstFetchInit(singleReadFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
  });
});

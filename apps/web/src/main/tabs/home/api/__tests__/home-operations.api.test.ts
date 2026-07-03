import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeOperationsApi, HomeOperationsFetchError } from '../home-operations.api';

const iso = '2026-07-03T00:00:00.000Z';

function stubOperationsFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': contentType },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function noticeListResponse() {
  return {
    items: [
      {
        id: 'notice-1',
        title: '운영 안내',
        summary: '서비스 운영 안내입니다.',
        severity: 'WARNING',
        relatedSeasonId: null,
        publishedAt: iso,
        expiresAt: null,
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    pageInfo: { hasNextPage: false, nextCursor: null },
  };
}

function supportTicketListResponse() {
  return {
    items: [
      {
        id: 'ticket-1',
        category: 'BUG',
        subject: '버그 문의',
        status: 'OPEN',
        relatedEntityId: null,
        appealCategory: null,
        emailReplyConsent: false,
        lastMessageAt: iso,
        closedAt: null,
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    pageInfo: { hasNextPage: false, nextCursor: null },
  };
}

describe('homeOperationsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('global notice list를 BFF route에서 읽고 shared schema로 검증한다', async () => {
    const fetchMock = stubOperationsFetch(noticeListResponse());

    await expect(
      homeOperationsApi.listGlobalNotices({ limit: 2, severity: 'WARNING' }),
    ).resolves.toMatchObject({
      items: [{ id: 'notice-1', severity: 'WARNING' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notices?limit=2&severity=WARNING',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('support ticket list query를 contract default로 정규화한다', async () => {
    const fetchMock = stubOperationsFetch(supportTicketListResponse());

    await expect(
      homeOperationsApi.listSupportTickets({ status: 'OPEN', limit: 3 }),
    ).resolves.toMatchObject({
      items: [{ id: 'ticket-1' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/support/tickets?status=OPEN&limit=3',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('schema mismatch와 upstream error는 raw body를 노출하지 않는 typed error로 반환한다', async () => {
    stubOperationsFetch({ items: [{ ...noticeListResponse().items[0], body: 'raw body' }] });

    await expect(homeOperationsApi.listGlobalNotices()).rejects.toMatchObject({
      name: 'HomeOperationsFetchError',
      code: 'HOME_OPERATIONS_UPSTREAM_INVALID',
      message: 'Home operations response did not match the public contract.',
    } satisfies Partial<HomeOperationsFetchError>);

    vi.unstubAllGlobals();
    stubOperationsFetch({ success: false, accessToken: 'must-not-leak' }, 500);

    await expect(homeOperationsApi.listGlobalNotices()).rejects.toMatchObject({
      code: 'HOME_OPERATIONS_UPSTREAM_UNAVAILABLE',
      message: 'Home operations upstream returned an error status.',
      status: 500,
    } satisfies Partial<HomeOperationsFetchError>);
  });
});

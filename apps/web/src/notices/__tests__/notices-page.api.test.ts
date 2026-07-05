import { afterEach, describe, expect, it, vi } from 'vitest';
import { noticesPageApi, NoticesPageFetchError } from '../api/notices-page.api';

const iso = '2026-07-03T00:00:00.000Z';

function stubFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': contentType } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function noticePreview() {
  return {
    id: 'notice-1',
    title: '운영 안내',
    summary: '서비스 운영 안내입니다.',
    severity: 'INFO',
    publishedAt: iso,
    expiresAt: null,
    relatedSeasonId: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

describe('noticesPageApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('공지 목록 query를 BFF route로 보내고 shared schema로 검증한다', async () => {
    const fetchMock = stubFetch({
      items: [noticePreview()],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    await expect(
      noticesPageApi.listNotices({ limit: 20, severity: 'INFO' }),
    ).resolves.toMatchObject({
      items: [{ id: 'notice-1' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notices?limit=20&severity=INFO',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('schema mismatch는 raw body를 노출하지 않는 typed error로 반환한다', async () => {
    stubFetch({ items: [{ body: 'must-not-leak' }] });

    await expect(noticesPageApi.listNotices()).rejects.toMatchObject({
      name: 'NoticesPageFetchError',
      code: 'NOTICES_UPSTREAM_INVALID',
      message: 'Notice response did not match the public contract.',
    } satisfies Partial<NoticesPageFetchError>);
  });
});

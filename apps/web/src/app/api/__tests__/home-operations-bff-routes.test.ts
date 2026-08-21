import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBffRequest, firstFetchInput, firstFetchInit, stubJsonFetch } from '@/test/bff-route';
import { GET as getNotice } from '../notices/[noticeId]/route';
import { GET as listNotices } from '../notices/route';

const iso = '2026-07-03T00:00:00.000Z';

function createNoticePreview(id = 'notice-1') {
  return {
    id,
    title: '운영 안내',
    summary: '서비스 운영 안내입니다.',
    severity: 'INFO',
    relatedSeasonId: null,
    publishedAt: iso,
    expiresAt: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

function createNoticeListResponse() {
  return {
    items: [createNoticePreview()],
    pageInfo: { hasNextPage: false, nextCursor: null },
  };
}

function createNoticeDetailResponse() {
  return {
    notice: {
      ...createNoticePreview(),
      body: '공지 상세 본문입니다.',
    },
  };
}

describe('home operations notices BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('global notice list query를 allowlist로 정규화해 public upstream에 전달한다', async () => {
    const fetchMock = stubJsonFetch(createNoticeListResponse());
    const response = await listNotices(createBffRequest('/api/notices?limit=2&severity=INFO'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(createNoticeListResponse());
    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/notices?limit=2&severity=INFO',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('unknown/duplicate query는 upstream 호출 없이 safe 400으로 거절한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const unknownResponse = await listNotices(createBffRequest('/api/notices?rawBody=true'));
    expect(unknownResponse.status).toBe(400);

    const duplicateResponse = await listNotices(createBffRequest('/api/notices?limit=1&limit=2'));
    expect(duplicateResponse.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('global notice list upstream schema drift는 fail-closed 처리한다', async () => {
    stubJsonFetch({ items: [{ ...createNoticePreview(), body: '목록에 섞이면 안 되는 본문' }] });

    const response = await listNotices(createBffRequest('/api/notices'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('global notice detail path를 encode하고 detail body contract만 전달한다', async () => {
    const fetchMock = stubJsonFetch(createNoticeDetailResponse());
    const response = await getNotice(createBffRequest('/api/notices/notice%201%2F2'), {
      params: Promise.resolve({ noticeId: 'notice 1/2' }),
    });

    expect(response.status).toBe(200);
    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/notices/notice%201%2F2');
    await expect(response.json()).resolves.toEqual(createNoticeDetailResponse());
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicProfileFull,
  createPublicProfileTombstone,
} from '@/test/home-profile-detail-fixtures';
import { getRoommateProfileDetail } from '../roommateProfileDetail.client';

function stubFetch(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function firstFetchUrl(fetchMock: ReturnType<typeof stubFetch>): URL {
  const input = fetchMock.mock.calls[0]?.[0];
  if (!input) throw new Error('fetch was not called');
  return new URL(String(input), 'http://localhost');
}

describe('roommateProfileDetail.client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('target path를 encode하고 detailEntryToken query로 FULL detail을 요청한다', async () => {
    const fetchMock = stubFetch(createPublicProfileFull({ id: 'user 1/2' }));
    const controller = new AbortController();

    const result = await getRoommateProfileDetail(
      { targetUserId: 'user 1/2', detailEntryToken: 'entry-token-1' },
      { signal: controller.signal },
    );
    const url = firstFetchUrl(fetchMock);

    expect(url.pathname).toBe('/api/profiles/user%201%2F2');
    expect(url.searchParams.get('detailEntryToken')).toBe('entry-token-1');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cache: 'no-store', signal: controller.signal }),
    );
    expect(result.detailState).toBe('FULL');
  });

  it('TOMBSTONE detail도 shared publicProfileSchema 결과로 반환한다', async () => {
    stubFetch(createPublicProfileTombstone());

    await expect(
      getRoommateProfileDetail({ targetUserId: 'removed-user', detailEntryToken: 'entry-token-1' }),
    ).resolves.toMatchObject({ detailState: 'TOMBSTONE' });
  });

  it('token이 없으면 fetch 없이 safe entry error로 닫는다', async () => {
    const fetchMock = stubFetch(createPublicProfileFull());

    await expect(
      getRoommateProfileDetail({ targetUserId: 'target-1', detailEntryToken: '   ' }),
    ).rejects.toMatchObject({ code: 'ROOMMATE_PROFILE_DETAIL_ENTRY_REQUIRED', retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('404 PROFILE_NOT_VISIBLE은 probing-safe error로 normalize한다', async () => {
    stubFetch(
      { success: false, code: 'PROFILE_NOT_VISIBLE', message: 'raw upstream' },
      { status: 404 },
    );

    await expect(
      getRoommateProfileDetail({ targetUserId: 'target-1', detailEntryToken: 'entry-token-1' }),
    ).rejects.toMatchObject({ code: 'PROFILE_NOT_VISIBLE', status: 404, retryable: false });
  });

  it('schema drift response는 token/raw body를 노출하지 않는 schema error로 닫는다', async () => {
    stubFetch({ id: 'target-1', detailState: 'FULL' });

    await expect(
      getRoommateProfileDetail({ targetUserId: 'target-1', detailEntryToken: 'secret-token' }),
    ).rejects.toMatchObject({ code: 'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID', retryable: true });
  });
});

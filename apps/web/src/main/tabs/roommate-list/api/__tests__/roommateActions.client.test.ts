import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRoommateBookmark,
  deleteRoommateBookmark,
  getRoommateBookmarkList,
} from '../roommateActions.client';

function stubFetch(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const serverTime = '2026-06-08T00:00:00.000Z';

describe('roommateActions.client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bookmark list는 query를 /api/bookmarks로 보내고 shared schema로 parse한다', async () => {
    const fetchMock = stubFetch({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      emptyState: { code: 'NO_BOOKMARKS' },
      sort: 'MATCH_SCORE',
      serverTime,
    });

    const response = await getRoommateBookmarkList({
      sort: 'MATCH_SCORE',
      cursor: 'c1',
      limit: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/bookmarks?sort=MATCH_SCORE&cursor=c1&limit=10', {
      cache: 'no-store',
      method: 'GET',
      signal: undefined,
    });
    expect(response.emptyState?.code).toBe('NO_BOOKMARKS');
  });

  it('bookmark create/delete는 targetUserId path segment를 encode하고 body를 보내지 않는다', async () => {
    const createFetch = stubFetch({
      bookmark: {
        id: 'bookmark-1',
        targetUserId: 'user 1/2',
        targetParticipantId: 'participant-1',
        bookmarkedAt: serverTime,
      },
      created: true,
      listMetadata: { sort: 'RECENT', serverTime },
    });

    await createRoommateBookmark('user 1/2');

    expect(createFetch).toHaveBeenCalledWith('/api/bookmarks/user%201%2F2', {
      cache: 'no-store',
      method: 'POST',
      signal: undefined,
    });

    vi.unstubAllGlobals();
    const deleteFetch = stubFetch({
      deleted: true,
      listMetadata: { sort: 'RECENT', serverTime },
    });

    await deleteRoommateBookmark('user 1/2');

    expect(deleteFetch).toHaveBeenCalledWith('/api/bookmarks/user%201%2F2', {
      cache: 'no-store',
      method: 'DELETE',
      signal: undefined,
    });
  });

  it('schema invalid response는 safe RoommateApiError로 닫는다', async () => {
    stubFetch({ items: [{ invalid: true }] });

    await expect(getRoommateBookmarkList()).rejects.toMatchObject({
      code: 'ROOMMATE_ACTION_SCHEMA_INVALID',
      retryable: true,
    });
  });
});

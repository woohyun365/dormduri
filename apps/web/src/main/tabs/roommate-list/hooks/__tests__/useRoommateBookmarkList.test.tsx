import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRoommateApiError } from '../../api/roommateApiErrors';
import {
  useRoommateBookmarkList,
  type RoommateBookmarkClientPort,
} from '../useRoommateBookmarkList';
import type { BookmarkListItem, BookmarkListResponse } from '@repo/shared/social-safety/bookmark';

const serverTime = '2026-06-08T00:00:00.000Z';

function createBookmarkItem(targetUserId = 'target-1'): BookmarkListItem {
  return {
    id: `bookmark-${targetUserId}`,
    targetUserId,
    targetParticipantId: `participant-${targetUserId}`,
    bookmarkedAt: serverTime,
    visibility: 'VISIBLE',
    profileSummary: {
      nickname: `북마크-${targetUserId}`,
      intro: '다시 확인하고 싶은 룸메이트예요.',
      smokingBehavior: 'NO',
      sleepHabit: 'NONE',
      relationshipStyle: 'CASUAL',
    },
    matchScore: 91,
  };
}

function createBookmarkListResponse(
  input: Partial<BookmarkListResponse> = {},
): BookmarkListResponse {
  return {
    items: input.items ?? [createBookmarkItem()],
    pageInfo: input.pageInfo ?? { hasNextPage: false, nextCursor: null },
    emptyState: input.emptyState ?? null,
    sort: input.sort ?? 'RECENT',
    serverTime,
  };
}

function createClient(
  overrides: Partial<RoommateBookmarkClientPort> = {},
): RoommateBookmarkClientPort {
  return {
    getRoommateBookmarkList: vi.fn(async () => createBookmarkListResponse()),
    createRoommateBookmark: vi.fn(async (targetUserId: string) => ({
      bookmark: {
        id: `bookmark-${targetUserId}`,
        targetUserId,
        targetParticipantId: `participant-${targetUserId}`,
        bookmarkedAt: serverTime,
      },
      created: true,
      listMetadata: { sort: 'RECENT' as const, serverTime },
    })),
    deleteRoommateBookmark: vi.fn(async () => ({
      deleted: true,
      listMetadata: { sort: 'RECENT' as const, serverTime },
    })),
    ...overrides,
  };
}

describe('useRoommateBookmarkList', () => {
  it('autoLoad 시 /api/bookmarks owner client를 sort/limit와 함께 호출한다', async () => {
    const client = createClient({
      getRoommateBookmarkList: vi.fn(async () =>
        createBookmarkListResponse({ pageInfo: { hasNextPage: true, nextCursor: 'cursor-2' } }),
      ),
    });

    const { result } = renderHook(() =>
      useRoommateBookmarkList({ client, initialSort: 'MATCH_SCORE', limit: 10, autoLoad: true }),
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(client.getRoommateBookmarkList).toHaveBeenCalledWith(
      { sort: 'MATCH_SCORE', cursor: null, limit: 10 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.items.map((item) => item.targetUserId)).toEqual(['target-1']);
    expect(result.current.canLoadMore).toBe(true);
  });

  it('sort 변경과 cursor loadMore는 owner list query만 갱신한다', async () => {
    const client = createClient({
      getRoommateBookmarkList: vi
        .fn()
        .mockResolvedValueOnce(
          createBookmarkListResponse({ pageInfo: { hasNextPage: true, nextCursor: 'cursor-2' } }),
        )
        .mockResolvedValueOnce(
          createBookmarkListResponse({
            sort: 'MATCH_SCORE',
            items: [createBookmarkItem('score-1')],
            pageInfo: { hasNextPage: true, nextCursor: 'score-cursor-2' },
          }),
        )
        .mockResolvedValueOnce(
          createBookmarkListResponse({
            sort: 'MATCH_SCORE',
            items: [createBookmarkItem('score-2')],
          }),
        ),
    });
    const { result } = renderHook(() => useRoommateBookmarkList({ client, autoLoad: true }));
    await waitFor(() => expect(result.current.nextCursor).toBe('cursor-2'));

    await act(async () => {
      await result.current.changeSort('MATCH_SCORE');
    });
    await waitFor(() => expect(result.current.items[0]?.targetUserId).toBe('score-1'));

    await act(async () => {
      await result.current.loadMore();
    });

    const listCalls = vi.mocked(client.getRoommateBookmarkList).mock.calls;
    expect(listCalls[1]?.[0]).toMatchObject({
      sort: 'MATCH_SCORE',
      cursor: null,
    });
    expect(listCalls[2]?.[0]).toMatchObject({
      sort: 'MATCH_SCORE',
      cursor: 'score-cursor-2',
    });
  });

  it('bookmark create는 optimistic bookmarked overlay를 만들고 duplicate pending을 막는다', async () => {
    let resolveCreate!: () => void;
    const createPromise = new Promise<
      Awaited<ReturnType<RoommateBookmarkClientPort['createRoommateBookmark']>>
    >((resolve) => {
      resolveCreate = () =>
        resolve({
          bookmark: {
            id: 'bookmark-target-2',
            targetUserId: 'target-2',
            targetParticipantId: 'participant-target-2',
            bookmarkedAt: serverTime,
          },
          created: true,
          listMetadata: { sort: 'RECENT' as const, serverTime },
        });
    });
    const client = createClient({ createRoommateBookmark: vi.fn(() => createPromise) });
    const { result } = renderHook(() => useRoommateBookmarkList({ client }));

    await act(async () => {
      void result.current.toggleBookmark('target-2', false);
    });
    expect(result.current.getOptimisticBookmarked('target-2', false)).toBe(true);

    await act(async () => {
      void result.current.toggleBookmark('target-2', false);
    });
    expect(client.createRoommateBookmark).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate();
      await createPromise;
    });
    expect(result.current.pendingTargetUserIds).toEqual([]);
  });

  it('bookmark delete 실패 시 optimistic 제거를 rollback한다', async () => {
    const client = createClient({
      deleteRoommateBookmark: vi.fn(async () => {
        throw createRoommateApiError({ code: 'ROOMMATE_ACTION_NETWORK_ERROR' });
      }),
    });
    const { result } = renderHook(() => useRoommateBookmarkList({ client, autoLoad: true }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.toggleBookmark('target-1', true);
    });

    expect(result.current.items.map((item) => item.targetUserId)).toEqual(['target-1']);
    expect(result.current.getOptimisticBookmarked('target-1', true)).toBe(true);
    expect(result.current.error?.code).toBe('ROOMMATE_ACTION_NETWORK_ERROR');
  });
});

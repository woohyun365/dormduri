import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRoommateApiError } from '../../api/roommateApiErrors';
import { useRoommateSearch, type RoommateSearchClientPort } from '../useRoommateSearch';
import {
  createCampusMergedManifest,
  createManifest,
  createManifestResponse,
  createPostMatchManifest,
  createSearchResponse,
  createSummary,
} from '../../model/search/__tests__/roommateSearchTestFixtures';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function paramsFromCall(client: RoommateSearchClientPort, index = 0): URLSearchParams {
  const query = vi.mocked(client.getRoommateSearch).mock.calls[index]?.[0];
  if (!(query instanceof URLSearchParams)) {
    throw new Error('search query is not URLSearchParams');
  }
  return query;
}

describe('useRoommateSearch', () => {
  it('mount 시 manifest preflight와 search를 BFF client port로 호출한다', async () => {
    const client: RoommateSearchClientPort = {
      getRoommateSearchManifest: vi.fn(async () => createManifestResponse(createManifest())),
      getRoommateSearch: vi.fn(async () => createSearchResponse({ nextCursor: 'cursor-next' })),
    };

    const { result } = renderHook(() =>
      useRoommateSearch({
        client,
        initialQuery: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' },
        limit: 15,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(client.getRoommateSearchManifest).toHaveBeenCalledWith(
      { scope: 'SAME_BUILDING_ONLY' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const params = paramsFromCall(client);
    expect(params.get('scope')).toBe('SAME_BUILDING_ONLY');
    expect(params.get('sort')).toBe('MATCH_SCORE');
    expect(params.get('limit')).toBe('15');
    expect(result.current.items.map((item) => item.id)).toEqual(['participant-1']);
    expect(result.current.nextCursor).toBe('cursor-next');
  });

  it('scope 변경은 cursor/items를 reset하고 새 manifest/search를 호출한다', async () => {
    const client: RoommateSearchClientPort = {
      getRoommateSearchManifest: vi
        .fn()
        .mockResolvedValueOnce(createManifestResponse(createManifest()))
        .mockResolvedValueOnce(createManifestResponse(createCampusMergedManifest())),
      getRoommateSearch: vi
        .fn()
        .mockResolvedValueOnce(createSearchResponse({ nextCursor: 'cursor-next' }))
        .mockResolvedValueOnce(
          createSearchResponse({
            manifest: createCampusMergedManifest(),
            items: [createSummary('campus-result')],
          }),
        ),
    };
    const { result } = renderHook(() =>
      useRoommateSearch({
        client,
        initialQuery: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' },
      }),
    );
    await waitFor(() => expect(result.current.nextCursor).toBe('cursor-next'));

    await act(async () => {
      await result.current.changeScope('CAMPUS_MERGED');
    });

    await waitFor(() =>
      expect(result.current.items.map((item) => item.id)).toEqual(['campus-result']),
    );
    const params = paramsFromCall(client, 1);
    expect(params.get('scope')).toBe('CAMPUS_MERGED');
    expect(params.get('sort')).toBe('NICKNAME');
    expect(params.has('cursor')).toBe(false);
    expect(result.current.nextCursor).toBeNull();
  });

  it('빠른 query 변경에서 늦게 도착한 이전 response는 최신 결과를 덮지 않는다', async () => {
    const firstSearch = createDeferred<ReturnType<typeof createSearchResponse>>();
    const secondSearch = createDeferred<ReturnType<typeof createSearchResponse>>();
    const client: RoommateSearchClientPort = {
      getRoommateSearchManifest: vi.fn(async () => createManifestResponse(createManifest())),
      getRoommateSearch: vi
        .fn()
        .mockReturnValueOnce(firstSearch.promise)
        .mockReturnValueOnce(secondSearch.promise),
    };
    const { result } = renderHook(() =>
      useRoommateSearch({
        client,
        initialQuery: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' },
      }),
    );
    await waitFor(() => expect(client.getRoommateSearch).toHaveBeenCalledTimes(1));

    act(() => {
      void result.current.changeSort('NICKNAME');
    });
    await waitFor(() => expect(client.getRoommateSearch).toHaveBeenCalledTimes(2));

    secondSearch.resolve(
      createSearchResponse({
        items: [createSummary('latest-result')],
        appliedSort: 'NICKNAME',
      }),
    );
    firstSearch.resolve(createSearchResponse({ items: [createSummary('stale-result')] }));

    await waitFor(() =>
      expect(result.current.items.map((item) => item.id)).toEqual(['latest-result']),
    );
    expect(result.current.query.sort).toBe('NICKNAME');
  });

  it('loadMore cursor가 INVALID_ROOMMATE_SEARCH_QUERY로 닫히면 stale cursor 없이 retry한다', async () => {
    const client: RoommateSearchClientPort = {
      getRoommateSearchManifest: vi.fn(async () => createManifestResponse(createManifest())),
      getRoommateSearch: vi
        .fn()
        .mockResolvedValueOnce(createSearchResponse({ nextCursor: 'expired-cursor' }))
        .mockRejectedValueOnce(
          createRoommateApiError({ code: 'INVALID_ROOMMATE_SEARCH_QUERY', status: 400 }),
        )
        .mockResolvedValueOnce(
          createSearchResponse({ items: [createSummary('cursor-recovered')], nextCursor: null }),
        ),
    };

    const { result } = renderHook(() =>
      useRoommateSearch({
        client,
        initialQuery: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' },
      }),
    );
    await waitFor(() => expect(result.current.nextCursor).toBe('expired-cursor'));

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() =>
      expect(result.current.items.map((item) => item.id)).toEqual(['cursor-recovered']),
    );
    expect(paramsFromCall(client, 1).get('cursor')).toBe('expired-cursor');
    expect(paramsFromCall(client, 2).has('cursor')).toBe(false);
    expect(result.current.statusMessage).toContain('최신 정책');
  });

  it('INVALID_ROOMMATE_SEARCH_QUERY는 manifest refetch 후 sanitize하고 one-shot retry한다', async () => {
    const client: RoommateSearchClientPort = {
      getRoommateSearchManifest: vi
        .fn()
        .mockResolvedValueOnce(createManifestResponse(createManifest()))
        .mockResolvedValueOnce(createManifestResponse(createPostMatchManifest())),
      getRoommateSearch: vi
        .fn()
        .mockRejectedValueOnce(
          createRoommateApiError({ code: 'INVALID_ROOMMATE_SEARCH_QUERY', status: 400 }),
        )
        .mockResolvedValueOnce(
          createSearchResponse({
            manifest: createPostMatchManifest(),
            items: [createSummary('recovered-result')],
            appliedSort: 'NICKNAME',
          }),
        ),
    };

    const { result } = renderHook(() =>
      useRoommateSearch({
        client,
        initialQuery: {
          scope: 'SAME_BUILDING_ONLY',
          sort: 'MATCH_SCORE',
          filters: { minScore: 90, sleepHabit: 'HAS' },
        },
      }),
    );

    await waitFor(() =>
      expect(result.current.items.map((item) => item.id)).toEqual(['recovered-result']),
    );

    expect(client.getRoommateSearchManifest).toHaveBeenCalledTimes(2);
    expect(client.getRoommateSearch).toHaveBeenCalledTimes(2);
    expect(result.current.query).toEqual({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'NICKNAME',
      filters: {},
    });
    expect(result.current.statusMessage).toContain('최신 정책');
    expect(paramsFromCall(client, 1).get('sort')).toBe('NICKNAME');
    expect(paramsFromCall(client, 1).has('minScore')).toBe(false);
  });
});

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createRoommateBookmark,
  deleteRoommateBookmark,
  getRoommateBookmarkList,
  type BookmarkListQueryParams,
} from '../api/roommateActions.client';
import { isRoommateApiError, type RoommateApiError } from '../api/roommateSearch.client';
import type {
  BookmarkEmptyStateCode,
  BookmarkListItem,
  BookmarkListResponse,
  BookmarkSort,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
} from '@repo/shared/social-safety/bookmark';

export interface RoommateBookmarkRequestOptions {
  readonly signal?: AbortSignal;
}

export interface RoommateBookmarkClientPort {
  readonly getRoommateBookmarkList: (
    query?: BookmarkListQueryParams,
    options?: RoommateBookmarkRequestOptions,
  ) => Promise<BookmarkListResponse>;
  readonly createRoommateBookmark: (
    targetUserId: string,
    options?: RoommateBookmarkRequestOptions,
  ) => Promise<CreateBookmarkResponse>;
  readonly deleteRoommateBookmark: (
    targetUserId: string,
    options?: RoommateBookmarkRequestOptions,
  ) => Promise<DeleteBookmarkResponse>;
}

export type RoommateBookmarkListStatus = 'idle' | 'loading' | 'success' | 'error';

export interface RoommateBookmarkListSnapshot {
  readonly status: RoommateBookmarkListStatus;
  readonly sort: BookmarkSort;
  readonly items: readonly BookmarkListItem[];
  readonly nextCursor: string | null;
  readonly emptyState: BookmarkEmptyStateCode | null;
  readonly error: RoommateApiError | null;
  readonly optimisticBookmarkState: Readonly<Record<string, boolean>>;
  readonly pendingTargetUserIds: readonly string[];
}

export interface UseRoommateBookmarkListOptions {
  readonly client?: RoommateBookmarkClientPort;
  readonly initialSort?: BookmarkSort;
  readonly limit?: number;
  readonly autoLoad?: boolean;
}

export interface UseRoommateBookmarkListResult extends RoommateBookmarkListSnapshot {
  readonly hasNextPage: boolean;
  readonly canLoadMore: boolean;
  readonly isTargetPending: (targetUserId: string) => boolean;
  readonly getOptimisticBookmarked: (targetUserId: string, fallback: boolean) => boolean;
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly changeSort: (sort: BookmarkSort) => Promise<void>;
  readonly toggleBookmark: (targetUserId: string, bookmarked: boolean) => Promise<void>;
  readonly dismissError: () => void;
}

const defaultRoommateBookmarkClient: RoommateBookmarkClientPort = {
  getRoommateBookmarkList,
  createRoommateBookmark,
  deleteRoommateBookmark,
};

export function useRoommateBookmarkList(
  options: UseRoommateBookmarkListOptions = {},
): UseRoommateBookmarkListResult {
  const client = options.client ?? defaultRoommateBookmarkClient;
  const limit = options.limit ?? 20;
  const autoLoad = options.autoLoad ?? false;
  const [snapshot, setSnapshot] = useState<RoommateBookmarkListSnapshot>(() => ({
    status: 'idle',
    sort: options.initialSort ?? 'RECENT',
    items: [],
    nextCursor: null,
    emptyState: null,
    error: null,
    optimisticBookmarkState: {},
    pendingTargetUserIds: [],
  }));
  const snapshotRef = useRef(snapshot);
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const runList = useCallback(
    async (mode: 'replace' | 'append' = 'replace', cursor: string | null = null) => {
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const isCurrent = () => sequenceRef.current === sequence && !controller.signal.aborted;

      setSnapshot((current) => {
        const next = { ...current, status: 'loading' as const, error: null };
        snapshotRef.current = next;
        return next;
      });

      try {
        const response = await client.getRoommateBookmarkList(
          { sort: snapshotRef.current.sort, cursor, limit },
          { signal: controller.signal },
        );
        if (!isCurrent()) return;

        setSnapshot((current) => {
          const next = {
            ...current,
            status: 'success' as const,
            sort: response.sort,
            items: mode === 'append' ? [...current.items, ...response.items] : response.items,
            nextCursor: response.pageInfo.nextCursor,
            emptyState: response.emptyState?.code ?? null,
            error: null,
          };
          snapshotRef.current = next;
          return next;
        });
      } catch (error) {
        if (!isCurrent()) return;
        if (isRoommateApiError(error)) {
          setSnapshot((current) => {
            const next = { ...current, status: 'error' as const, error };
            snapshotRef.current = next;
            return next;
          });
        }
      }
    },
    [client, limit],
  );

  useEffect(() => {
    if (!autoLoad) return;
    void runList('replace');
    return () => {
      abortRef.current?.abort();
    };
  }, [autoLoad, runList]);

  const setPending = useCallback((targetUserId: string, pending: boolean) => {
    setSnapshot((current) => {
      const pendingIds = new Set(current.pendingTargetUserIds);
      if (pending) {
        pendingIds.add(targetUserId);
      } else {
        pendingIds.delete(targetUserId);
      }
      const next = { ...current, pendingTargetUserIds: [...pendingIds] };
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const setOptimisticBookmark = useCallback((targetUserId: string, bookmarked: boolean | null) => {
    setSnapshot((current) => {
      const optimisticBookmarkState = { ...current.optimisticBookmarkState };
      if (bookmarked === null) {
        delete optimisticBookmarkState[targetUserId];
      } else {
        optimisticBookmarkState[targetUserId] = bookmarked;
      }
      const next = { ...current, optimisticBookmarkState };
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const actions = useMemo(
    () => ({
      refresh: async () => runList('replace'),
      loadMore: async () => {
        const cursor = snapshotRef.current.nextCursor;
        if (!cursor) return;
        await runList('append', cursor);
      },
      changeSort: async (sort: BookmarkSort) => {
        if (snapshotRef.current.sort === sort) return;
        const next = {
          ...snapshotRef.current,
          sort,
          items: [],
          nextCursor: null,
          emptyState: null,
          error: null,
        };
        snapshotRef.current = next;
        setSnapshot(next);
        await runList('replace');
      },
      toggleBookmark: async (targetUserId: string, bookmarked: boolean) => {
        const current = snapshotRef.current;
        if (current.pendingTargetUserIds.includes(targetUserId)) return;

        const previousItems = current.items;
        const previousEmptyState = current.emptyState;
        setPending(targetUserId, true);
        setOptimisticBookmark(targetUserId, !bookmarked);

        if (bookmarked) {
          setSnapshot((active) => {
            const next = {
              ...active,
              items: active.items.filter((item) => item.targetUserId !== targetUserId),
              emptyState: active.items.length === 1 ? null : active.emptyState,
            };
            snapshotRef.current = next;
            return next;
          });
        }

        try {
          if (bookmarked) {
            await client.deleteRoommateBookmark(targetUserId);
            if (previousItems.length === 1) {
              await runList('replace');
            }
          } else {
            await client.createRoommateBookmark(targetUserId);
          }
        } catch (error) {
          if (isRoommateApiError(error)) {
            setSnapshot((active) => {
              const next = {
                ...active,
                items: previousItems,
                emptyState: previousEmptyState,
                error,
              };
              snapshotRef.current = next;
              return next;
            });
          }
          setOptimisticBookmark(targetUserId, bookmarked);
        } finally {
          setPending(targetUserId, false);
        }
      },
      dismissError: () => {
        setSnapshot((current) => {
          const next = { ...current, error: null };
          snapshotRef.current = next;
          return next;
        });
      },
    }),
    [client, runList, setOptimisticBookmark, setPending],
  );

  const hasNextPage = snapshot.nextCursor !== null;
  const pendingSet = useMemo(
    () => new Set(snapshot.pendingTargetUserIds),
    [snapshot.pendingTargetUserIds],
  );

  return {
    ...snapshot,
    hasNextPage,
    canLoadMore: snapshot.status !== 'loading' && hasNextPage,
    isTargetPending: (targetUserId: string) => pendingSet.has(targetUserId),
    getOptimisticBookmarked: (targetUserId: string, fallback: boolean) =>
      snapshot.optimisticBookmarkState[targetUserId] ?? fallback,
    ...actions,
  };
}

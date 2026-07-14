'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getRoommateSearch,
  getRoommateSearchManifest,
  isRoommateApiError,
  type RoommateApiError,
  type RoommateSearchQueryParams,
} from '../api/roommateSearch.client';
import {
  buildRoommateSearchQueryParams,
  type RoommateSearchCriteriaFilterKey,
  type RoommateSearchFilterCriteria,
  type RoommateSearchQueryCriteria,
} from '../model/search/roommateSearchQuery';
import {
  applyRoommateSearchFailure,
  applyRoommateSearchFilters,
  applyRoommateSearchManifestLoaded,
  applyRoommateSearchScopeChange,
  applyRoommateSearchSortChange,
  applyRoommateSearchSuccess,
  createInitialRoommateSearchSnapshot,
  markRoommateSearchLoading,
  recoverRoommateSearchInvalidQuery,
  removeRoommateSearchFilter,
  resetRoommateSearchFilters,
  type RoommateSearchResultMode,
  type RoommateSearchRuntimeSnapshot,
} from '../model/search/roommateSearchState';
import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';

export interface RoommateSearchRequestOptions {
  readonly signal?: AbortSignal;
}

export interface RoommateSearchClientPort {
  readonly getRoommateSearch: (
    query?: RoommateSearchQueryParams,
    options?: RoommateSearchRequestOptions,
  ) => Promise<RoommateSearchResponse>;
  readonly getRoommateSearchManifest: (
    query?: RoommateSearchQueryParams,
    options?: RoommateSearchRequestOptions,
  ) => Promise<RoommateSearchManifestResponse>;
}

export interface UseRoommateSearchOptions {
  readonly client?: RoommateSearchClientPort;
  readonly initialQuery?: Partial<RoommateSearchQueryCriteria>;
  readonly limit?: number;
  readonly autoLoad?: boolean;
}

export interface UseRoommateSearchResult extends RoommateSearchRuntimeSnapshot {
  readonly hasNextPage: boolean;
  readonly canLoadMore: boolean;
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly changeScope: (scope: RoommateSearchScope) => Promise<void>;
  readonly changeSort: (sort: RoommateSearchSort) => Promise<void>;
  readonly applyFilters: (filters: RoommateSearchFilterCriteria) => Promise<void>;
  readonly removeFilter: (key: RoommateSearchCriteriaFilterKey) => Promise<void>;
  readonly resetFilters: () => Promise<void>;
}

const defaultRoommateSearchClient: RoommateSearchClientPort = {
  getRoommateSearch,
  getRoommateSearchManifest,
};

export function useRoommateSearch(options: UseRoommateSearchOptions = {}): UseRoommateSearchResult {
  const client = options.client ?? defaultRoommateSearchClient;
  const limit = options.limit ?? 20;
  const autoLoad = options.autoLoad ?? true;
  const [snapshot, setSnapshot] = useState<RoommateSearchRuntimeSnapshot>(() =>
    createInitialRoommateSearchSnapshot(options.initialQuery),
  );
  const snapshotRef = useRef(snapshot);
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const setRoommateSearchError = useCallback((error: RoommateApiError) => {
    setSnapshot((current) => {
      const next = applyRoommateSearchFailure(current, error);
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const recoverAndRetry = useCallback(
    async (
      query: RoommateSearchQueryCriteria,
      mode: RoommateSearchResultMode,
      controller: AbortController,
      sequence: number,
    ) => {
      const isCurrent = () => sequenceRef.current === sequence && !controller.signal.aborted;
      try {
        const manifestResponse = await client.getRoommateSearchManifest(
          { scope: query.scope },
          { signal: controller.signal },
        );
        if (!isCurrent()) return;

        const recovered = recoverRoommateSearchInvalidQuery(snapshotRef.current, manifestResponse);
        const loadingSearch = markRoommateSearchLoading(recovered, 'loading-search');
        snapshotRef.current = loadingSearch;
        setSnapshot(loadingSearch);

        const response = await client.getRoommateSearch(
          buildRoommateSearchQueryParams(recovered.query, { limit }),
          { signal: controller.signal },
        );
        if (!isCurrent()) return;

        setSnapshot((current) => {
          const next = applyRoommateSearchSuccess(current, response, mode, recovered.statusMessage);
          snapshotRef.current = next;
          return next;
        });
      } catch (error) {
        if (!isCurrent()) return;
        if (isRoommateApiError(error)) {
          setRoommateSearchError(error);
        }
      }
    },
    [client, limit, setRoommateSearchError],
  );

  const runSearch = useCallback(
    async (
      query: RoommateSearchQueryCriteria,
      mode: RoommateSearchResultMode = 'replace',
      cursor: string | null = null,
      retryOnInvalidQuery = true,
    ) => {
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const isCurrent = () => sequenceRef.current === sequence && !controller.signal.aborted;

      try {
        setSnapshot((current) => {
          const loading = markRoommateSearchLoading(
            { ...current, query },
            mode === 'append' ? 'loading-more' : 'loading-manifest',
          );
          snapshotRef.current = loading;
          return loading;
        });

        const manifestResponse = await client.getRoommateSearchManifest(
          { scope: query.scope },
          { signal: controller.signal },
        );
        if (!isCurrent()) return;

        const manifestLoaded = applyRoommateSearchManifestLoaded(
          snapshotRef.current,
          manifestResponse,
        );
        const requestQuery = manifestLoaded.query;
        const loadingSearch = markRoommateSearchLoading(
          manifestLoaded,
          mode === 'append' ? 'loading-more' : 'loading-search',
        );
        snapshotRef.current = loadingSearch;
        setSnapshot(loadingSearch);

        const response = await client.getRoommateSearch(
          buildRoommateSearchQueryParams(requestQuery, { limit, cursor }),
          { signal: controller.signal },
        );
        if (!isCurrent()) return;

        setSnapshot((current) => {
          const next = applyRoommateSearchSuccess(current, response, mode);
          snapshotRef.current = next;
          return next;
        });
      } catch (error) {
        if (!isCurrent()) return;

        if (
          retryOnInvalidQuery &&
          isRoommateApiError(error) &&
          error.code === 'INVALID_ROOMMATE_SEARCH_QUERY'
        ) {
          await recoverAndRetry(query, mode, controller, sequence);
          return;
        }

        if (isRoommateApiError(error)) {
          setRoommateSearchError(error);
        }
      }
    },
    [client, limit, recoverAndRetry, setRoommateSearchError],
  );

  useEffect(() => {
    if (!autoLoad) return;
    void runSearch(snapshotRef.current.query);
    return () => {
      abortRef.current?.abort();
    };
  }, [autoLoad, runSearch]);

  const actions = useMemo(
    () => ({
      refresh: async () => runSearch(snapshotRef.current.query),
      loadMore: async () => {
        const cursor = snapshotRef.current.nextCursor;
        if (!cursor) return;
        await runSearch(snapshotRef.current.query, 'append', cursor);
      },
      changeScope: async (scope: RoommateSearchScope) => {
        const next = applyRoommateSearchScopeChange(snapshotRef.current, scope);
        snapshotRef.current = next;
        setSnapshot(next);
        await runSearch(next.query);
      },
      changeSort: async (sort: RoommateSearchSort) => {
        const next = applyRoommateSearchSortChange(snapshotRef.current, sort);
        snapshotRef.current = next;
        setSnapshot(next);
        await runSearch(next.query);
      },
      applyFilters: async (filters: RoommateSearchFilterCriteria) => {
        const next = applyRoommateSearchFilters(snapshotRef.current, filters);
        snapshotRef.current = next;
        setSnapshot(next);
        await runSearch(next.query);
      },
      removeFilter: async (key: RoommateSearchCriteriaFilterKey) => {
        const next = removeRoommateSearchFilter(snapshotRef.current, key);
        snapshotRef.current = next;
        setSnapshot(next);
        await runSearch(next.query);
      },
      resetFilters: async () => {
        const next = resetRoommateSearchFilters(snapshotRef.current);
        snapshotRef.current = next;
        setSnapshot(next);
        await runSearch(next.query);
      },
    }),
    [runSearch],
  );

  const hasNextPage = snapshot.nextCursor !== null;

  return {
    ...snapshot,
    hasNextPage,
    canLoadMore: snapshot.status !== 'loading-search' && hasNextPage,
    ...actions,
  };
}

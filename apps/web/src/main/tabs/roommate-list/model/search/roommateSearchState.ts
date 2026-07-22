import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search/contract';
import type { RoommateApiError } from '../../api/roommateApiErrors';
import {
  mapRoommateSearchManifest,
  sanitizeRoommateSearchQueryForManifest,
  type RoommateSearchManifestModel,
} from '../filters/roommateSearchManifestModel';
import {
  cloneRoommateSearchFilterCriteria,
  createDefaultRoommateSearchQueryCriteria,
  getDefaultRoommateSearchSortForScope,
  withoutRoommateSearchFilterCriteriaKey,
  type RoommateSearchCriteriaFilterKey,
  type RoommateSearchFilterCriteria,
  type RoommateSearchQueryCriteria,
} from './roommateSearchQuery';
import {
  mapRoommateSearchAvailabilityNotices,
  type RoommateSearchNoticeModel,
} from './roommateSearchNotices';

export type RoommateSearchStatus =
  | 'idle'
  | 'loading-manifest'
  | 'loading-search'
  | 'loading-more'
  | 'success'
  | 'error';

export type RoommateSearchResultMode = 'replace' | 'append';

export interface RoommateSearchRuntimeSnapshot {
  readonly status: RoommateSearchStatus;
  readonly query: RoommateSearchQueryCriteria;
  readonly manifest: RoommateSearchManifestModel | null;
  readonly scopeAvailability: RoommateSearchResponse['scopeAvailability'] | null;
  readonly response: RoommateSearchResponse | null;
  readonly nextCursor: string | null;
  readonly items: readonly RoommateSearchSummary[];
  readonly notices: readonly RoommateSearchNoticeModel[];
  readonly statusMessage: string | null;
  readonly error: RoommateApiError | null;
}

const INVALID_QUERY_RECOVERED_MESSAGE =
  '검색 조건이 최신 정책과 맞지 않아 현재 사용할 수 있는 조건으로 다시 조정했어요.';

export function createInitialRoommateSearchSnapshot(
  initialQuery?: Partial<RoommateSearchQueryCriteria>,
): RoommateSearchRuntimeSnapshot {
  return {
    status: 'idle',
    query: createDefaultRoommateSearchQueryCriteria(initialQuery),
    manifest: null,
    scopeAvailability: null,
    response: null,
    nextCursor: null,
    items: [],
    notices: [],
    statusMessage: null,
    error: null,
  };
}

export function markRoommateSearchLoading(
  snapshot: RoommateSearchRuntimeSnapshot,
  status: Extract<RoommateSearchStatus, 'loading-manifest' | 'loading-search' | 'loading-more'>,
): RoommateSearchRuntimeSnapshot {
  return {
    ...snapshot,
    status,
    error: null,
  };
}

export function applyRoommateSearchScopeChange(
  snapshot: RoommateSearchRuntimeSnapshot,
  scope: RoommateSearchScope,
): RoommateSearchRuntimeSnapshot {
  return prepareReplacement({
    ...snapshot,
    query: {
      ...snapshot.query,
      scope,
      sort: getDefaultRoommateSearchSortForScope(scope),
    },
    statusMessage: null,
    error: null,
  });
}

export function applyRoommateSearchSortChange(
  snapshot: RoommateSearchRuntimeSnapshot,
  sort: RoommateSearchSort,
): RoommateSearchRuntimeSnapshot {
  return prepareReplacement({
    ...snapshot,
    query: {
      ...snapshot.query,
      sort,
    },
    statusMessage: null,
    error: null,
  });
}

export function applyRoommateSearchFilters(
  snapshot: RoommateSearchRuntimeSnapshot,
  filters: RoommateSearchFilterCriteria,
): RoommateSearchRuntimeSnapshot {
  return prepareReplacement({
    ...snapshot,
    query: {
      ...snapshot.query,
      filters: cloneRoommateSearchFilterCriteria(filters),
    },
    statusMessage: null,
    error: null,
  });
}

export function removeRoommateSearchFilter(
  snapshot: RoommateSearchRuntimeSnapshot,
  key: RoommateSearchCriteriaFilterKey,
): RoommateSearchRuntimeSnapshot {
  return prepareReplacement({
    ...snapshot,
    query: {
      ...snapshot.query,
      filters: withoutRoommateSearchFilterCriteriaKey(snapshot.query.filters, key),
    },
    statusMessage: null,
    error: null,
  });
}

export function resetRoommateSearchFilters(
  snapshot: RoommateSearchRuntimeSnapshot,
): RoommateSearchRuntimeSnapshot {
  return applyRoommateSearchFilters(snapshot, {});
}

export function applyRoommateSearchManifestLoaded(
  snapshot: RoommateSearchRuntimeSnapshot,
  response: RoommateSearchManifestResponse,
): RoommateSearchRuntimeSnapshot {
  const manifest = mapRoommateSearchManifest(response.manifest);
  const sanitizeResult = sanitizeRoommateSearchQueryForManifest(snapshot.query, manifest);

  return {
    ...snapshot,
    status: 'idle',
    query: sanitizeResult.query,
    manifest,
    scopeAvailability: response.scopeAvailability,
    notices: mapRoommateSearchAvailabilityNotices(response.availabilityNotices),
    statusMessage: sanitizeResult.statusMessage ?? snapshot.statusMessage,
    nextCursor: sanitizeResult.cursorShouldReset ? null : snapshot.nextCursor,
    items: snapshot.items,
    error: null,
  };
}

export function applyRoommateSearchSuccess(
  snapshot: RoommateSearchRuntimeSnapshot,
  response: RoommateSearchResponse,
  mode: RoommateSearchResultMode,
  statusMessage: string | null = null,
): RoommateSearchRuntimeSnapshot {
  const manifest = mapRoommateSearchManifest(response.manifest);
  const sanitizeResult = sanitizeRoommateSearchQueryForManifest(snapshot.query, manifest);
  const canAppend = mode === 'append' && !sanitizeResult.cursorShouldReset;

  return {
    ...snapshot,
    status: 'success',
    query: sanitizeResult.query,
    manifest,
    scopeAvailability: response.scopeAvailability,
    response,
    nextCursor: response.pageInfo.nextCursor,
    items: canAppend ? [...snapshot.items, ...response.items] : response.items,
    notices: mapRoommateSearchAvailabilityNotices(response.availabilityNotices),
    statusMessage: statusMessage ?? sanitizeResult.statusMessage,
    error: null,
  };
}

export function recoverRoommateSearchInvalidQuery(
  snapshot: RoommateSearchRuntimeSnapshot,
  response: RoommateSearchManifestResponse,
): RoommateSearchRuntimeSnapshot {
  const recovered = applyRoommateSearchManifestLoaded(snapshot, response);
  return prepareReplacement({
    ...recovered,
    status: 'idle',
    statusMessage: INVALID_QUERY_RECOVERED_MESSAGE,
    error: null,
  });
}

export function applyRoommateSearchFailure(
  snapshot: RoommateSearchRuntimeSnapshot,
  error: RoommateApiError,
): RoommateSearchRuntimeSnapshot {
  return {
    ...snapshot,
    status: 'error',
    error,
    statusMessage: error.message,
  };
}

export function resetRoommateSearchResults(
  snapshot: RoommateSearchRuntimeSnapshot,
): RoommateSearchRuntimeSnapshot {
  return resetResults(snapshot);
}

function resetResults(snapshot: RoommateSearchRuntimeSnapshot): RoommateSearchRuntimeSnapshot {
  return {
    ...snapshot,
    response: null,
    nextCursor: null,
    items: [],
  };
}

function prepareReplacement(
  snapshot: RoommateSearchRuntimeSnapshot,
): RoommateSearchRuntimeSnapshot {
  return {
    ...snapshot,
    nextCursor: null,
  };
}

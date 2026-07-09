import { useEffect, useLayoutEffect } from 'react';
import {
  createRoommateStoryManifestResponse,
  type RoommateStoryScenario,
} from './roommate-story-scenarios';
import type {
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';

const ROOMMATE_STORY_FETCH_KEY = '__knuRoommateTabStoryFetch__';
const ISO_NOW = '2026-07-06T03:00:00.000Z';
const useStoryFetchEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type StoryFetchStore = {
  originalFetch: typeof fetch;
  refCount: number;
  scenario: RoommateStoryScenario;
  submittedMatchRequest: StorySubmittedMatchRequest | null;
};

export type StoryRequest = {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
};

type StorySubmittedMatchRequest = {
  targetUserId: string;
  requestId: string;
  createdAt: string;
  expiresAt: string;
};

export function useRoommateStoryApiFixtures(scenario: RoommateStoryScenario) {
  useStoryFetchEffect(() => {
    if (typeof window === 'undefined') return;

    const globalStore = globalThis as typeof globalThis & {
      [ROOMMATE_STORY_FETCH_KEY]?: StoryFetchStore;
    };

    if (globalStore[ROOMMATE_STORY_FETCH_KEY]) {
      globalStore[ROOMMATE_STORY_FETCH_KEY].refCount += 1;
      globalStore[ROOMMATE_STORY_FETCH_KEY].scenario = scenario;
      globalStore[ROOMMATE_STORY_FETCH_KEY].submittedMatchRequest = null;
      return () => releaseRoommateStoryFetchShim(globalStore);
    }

    const originalFetch = window.fetch.bind(window);
    globalStore[ROOMMATE_STORY_FETCH_KEY] = {
      originalFetch: window.fetch,
      refCount: 1,
      scenario,
      submittedMatchRequest: null,
    };

    window.fetch = async (input, init) => {
      const store = globalStore[ROOMMATE_STORY_FETCH_KEY];
      const activeScenario = store?.scenario ?? scenario;
      const request = resolveStoryRequest(input, init);
      const response = resolveRoommateStoryResponse(request, activeScenario, store ?? null);
      if (response) return response;
      return originalFetch(input, init);
    };

    return () => releaseRoommateStoryFetchShim(globalStore);
  }, [scenario]);
}

function releaseRoommateStoryFetchShim(
  globalStore: typeof globalThis & { [ROOMMATE_STORY_FETCH_KEY]?: StoryFetchStore },
) {
  const store = globalStore[ROOMMATE_STORY_FETCH_KEY];
  if (!store) return;

  store.refCount -= 1;
  if (store.refCount <= 0) {
    window.fetch = store.originalFetch;
    delete globalStore[ROOMMATE_STORY_FETCH_KEY];
  }
}

function resolveStoryRequest(input: Parameters<typeof fetch>[0], init?: RequestInit): StoryRequest {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  const url = new URL(rawUrl, window.location.origin);

  return {
    method: (
      init?.method ?? (typeof input === 'string' || input instanceof URL ? 'GET' : input.method)
    ).toUpperCase(),
    pathname: url.pathname,
    searchParams: url.searchParams,
  };
}

function resolveRoommateStoryResponse(
  request: StoryRequest,
  scenario: RoommateStoryScenario,
  store: StoryFetchStore | null,
): Response | Promise<Response> | null {
  if (request.method === 'GET' && request.pathname === '/api/roommate-search/manifest') {
    return createMaybeDelayedStoryJsonResponse(
      createRoommateStoryManifestResponse(
        scenario,
        resolveRequestedSearchScope(request.searchParams),
      ),
      scenario.searchResponseDelayMs,
    );
  }

  if (request.method === 'GET' && request.pathname === '/api/roommate-search') {
    if (scenario.searchErrorCode) {
      return createStoryJsonResponse(
        { code: scenario.searchErrorCode },
        scenario.searchErrorStatus ?? 503,
      );
    }
    return createMaybeDelayedStoryJsonResponse(
      createRoommateStorySearchResponse(scenario, request, store?.submittedMatchRequest ?? null),
      scenario.searchResponseDelayMs,
    );
  }

  if (request.method === 'GET' && request.pathname === '/api/bookmarks') {
    return createStoryJsonResponse(scenario.bookmarkResponse);
  }

  if (/^\/api\/bookmarks\/[^/]+$/.test(request.pathname) && request.method === 'POST') {
    if (scenario.bookmarkError) {
      return createStoryJsonResponse(
        { code: scenario.bookmarkError.code },
        scenario.bookmarkError.status,
      );
    }
    const targetUserId = decodeURIComponent(request.pathname.split('/').at(-1) ?? 'story-target');
    return createStoryJsonResponse({
      bookmark: {
        id: `story-bookmark-${targetUserId}`,
        targetUserId,
        targetParticipantId: `participant-${targetUserId}`,
        bookmarkedAt: ISO_NOW,
      },
      created: true,
      listMetadata: { sort: 'RECENT', serverTime: ISO_NOW },
    });
  }

  if (/^\/api\/bookmarks\/[^/]+$/.test(request.pathname) && request.method === 'DELETE') {
    if (scenario.bookmarkError) {
      return createStoryJsonResponse(
        { code: scenario.bookmarkError.code },
        scenario.bookmarkError.status,
      );
    }
    return createStoryJsonResponse({
      deleted: true,
      listMetadata: { sort: 'RECENT', serverTime: ISO_NOW },
    });
  }

  if (/^\/api\/profiles\/[^/]+$/.test(request.pathname) && request.method === 'GET') {
    const targetUserId = decodeURIComponent(request.pathname.split('/').at(-1) ?? '');
    const error = scenario.profileErrorByTargetUserId?.[targetUserId];
    if (error) return createStoryJsonResponse({ code: error.code }, error.status);

    const profile = scenario.profileByTargetUserId[targetUserId];
    if (!profile) return createStoryJsonResponse({ code: 'PROFILE_NOT_VISIBLE' }, 404);
    return createStoryJsonResponse(profile);
  }

  if (request.pathname === '/api/matches/requests' && request.method === 'POST') {
    if (typeof scenario.responseDelayMs === 'number') {
      return createDelayedStoryJsonResponse(
        scenario.matchRequestResponse,
        scenario.responseDelayMs,
        () => recordSubmittedMatchRequest(store, scenario),
      );
    }
    if (scenario.matchRequestError) {
      return createStoryJsonResponse(
        { code: scenario.matchRequestError.code },
        scenario.matchRequestError.status,
      );
    }
    recordSubmittedMatchRequest(store, scenario);
    return createStoryJsonResponse(scenario.matchRequestResponse);
  }

  if (/^\/api\/blocks\/[^/]+$/.test(request.pathname) && request.method === 'POST') {
    if (typeof scenario.responseDelayMs === 'number') {
      return createDelayedStoryJsonResponse(scenario.blockResponse, scenario.responseDelayMs);
    }
    if (scenario.blockError) {
      return createStoryJsonResponse(
        { code: scenario.blockError.code },
        scenario.blockError.status,
      );
    }
    return createStoryJsonResponse(scenario.blockResponse);
  }

  if (request.pathname === '/api/reports' && request.method === 'POST') {
    if (typeof scenario.responseDelayMs === 'number') {
      return createDelayedStoryJsonResponse(scenario.reportResponse, scenario.responseDelayMs);
    }
    if (scenario.reportError) {
      return createStoryJsonResponse(
        { code: scenario.reportError.code },
        scenario.reportError.status,
      );
    }
    return createStoryJsonResponse(scenario.reportResponse);
  }

  return null;
}

export function createRoommateStorySearchResponse(
  scenario: RoommateStoryScenario,
  request: StoryRequest,
  submittedMatchRequest: StorySubmittedMatchRequest | null = null,
): RoommateSearchResponse {
  const response = resolveScenarioSearchResponse(
    scenario,
    resolveRequestedSearchScope(request.searchParams),
  );
  return paginateSearchResponse(
    sortStorySearchResponse(
      decorateSubmittedMatchRequest(response, submittedMatchRequest),
      resolveRequestedSearchSort(request.searchParams),
    ),
    request.searchParams,
  );
}

function resolveScenarioSearchResponse(
  scenario: RoommateStoryScenario,
  requestedScope: RoommateSearchScope | null,
): RoommateSearchResponse {
  if (requestedScope && scenario.searchResponsesByScope?.[requestedScope]) {
    return scenario.searchResponsesByScope[requestedScope];
  }

  return scenario.searchResponse;
}

function recordSubmittedMatchRequest(
  store: StoryFetchStore | null,
  scenario: RoommateStoryScenario,
) {
  if (!store) return;
  const request = scenario.matchRequestResponse.request;
  store.submittedMatchRequest = {
    targetUserId: request.counterpartUserId,
    requestId: request.id,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
}

function decorateSubmittedMatchRequest(
  response: RoommateSearchResponse,
  submittedMatchRequest: StorySubmittedMatchRequest | null,
): RoommateSearchResponse {
  if (!submittedMatchRequest) return response;

  return {
    ...response,
    items: response.items.map((item) =>
      item.id === submittedMatchRequest.targetUserId
        ? {
            ...item,
            pendingMatchRequest: {
              id: submittedMatchRequest.requestId,
              direction: 'SENT',
              createdAt: submittedMatchRequest.createdAt,
              expiresAt: submittedMatchRequest.expiresAt,
            },
          }
        : item,
    ),
  };
}

function paginateSearchResponse(
  response: RoommateSearchResponse,
  searchParams: URLSearchParams,
): RoommateSearchResponse {
  const limit = normalizeLimit(searchParams.get('limit'), response.items.length);
  const offset = normalizeCursor(searchParams.get('cursor'));
  const items = response.items.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const hasNextPage = nextOffset < response.items.length;

  return {
    ...response,
    resultSummary: createSearchResultSummary(items),
    pageInfo: {
      hasNextPage,
      nextCursor: hasNextPage ? `story-cursor-${nextOffset}` : null,
    },
    items,
  };
}

function createSearchResultSummary(
  items: readonly RoommateSearchResponse['items'][number][],
): RoommateSearchResponse['resultSummary'] {
  const detailViewableCount = items.filter((item) => item.exposure.detailViewable).length;
  const scoreVisibleCount = items.filter((item) => item.exposure.scoreVisible).length;

  return {
    summaryOnlyCount: items.length - detailViewableCount,
    detailViewableCount,
    scoreVisibleCount,
  };
}

function resolveRequestedSearchScope(searchParams: URLSearchParams): RoommateSearchScope | null {
  const scope = searchParams.get('scope');
  return scope === 'CAMPUS_MERGED' || scope === 'SAME_BUILDING_ONLY' ? scope : null;
}

function resolveRequestedSearchSort(searchParams: URLSearchParams): RoommateSearchSort | null {
  const sort = searchParams.get('sort');
  return sort === 'MATCH_SCORE' || sort === 'NICKNAME' ? sort : null;
}

function sortStorySearchResponse(
  response: RoommateSearchResponse,
  requestedSort: RoommateSearchSort | null,
): RoommateSearchResponse {
  const sort = resolveApplicableStorySearchSort(response, requestedSort);
  const items = [...response.items].sort((left, right) => {
    if (sort === 'MATCH_SCORE') {
      const scoreDiff = (right.matchScore ?? -1) - (left.matchScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return left.profileSummary.nickname.localeCompare(right.profileSummary.nickname, 'ko-KR');
  });

  return {
    ...response,
    appliedSort: sort,
    items,
  };
}

function resolveApplicableStorySearchSort(
  response: RoommateSearchResponse,
  requestedSort: RoommateSearchSort | null,
): RoommateSearchSort {
  if (requestedSort && response.manifest.sorts.options.includes(requestedSort)) {
    return requestedSort;
  }
  return response.appliedSort;
}

function normalizeLimit(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), 50));
}

function normalizeCursor(value: string | null): number {
  if (!value) return 0;
  const match = /^story-cursor-(\d+)$/u.exec(value);
  if (!match) return 0;
  return Number(match[1]);
}

function createStoryJsonResponse(json: unknown, status = 200): Response {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createMaybeDelayedStoryJsonResponse(
  json: unknown,
  delayMs: number | undefined,
): Response | Promise<Response> {
  if (typeof delayMs === 'number') {
    return createDelayedStoryJsonResponse(json, delayMs);
  }
  return createStoryJsonResponse(json);
}

async function createDelayedStoryJsonResponse(
  json: unknown,
  delayMs: number,
  beforeRespond?: () => void,
): Promise<Response> {
  await new Promise((done) => window.setTimeout(done, delayMs));
  beforeRespond?.();
  return createStoryJsonResponse(json);
}

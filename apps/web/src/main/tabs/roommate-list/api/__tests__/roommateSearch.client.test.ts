import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRoommateSearch,
  getRoommateSearchManifest,
  isRoommateApiError,
} from '../roommateSearch.client';

function createRoommateManifestResponse() {
  return {
    scope: 'SAME_BUILDING_ONLY',
    scopeAvailability: {
      campusMerged: true,
      sameBuildingOnly: true,
    },
    manifest: {
      manifestRevision: 'manifest-rev-1',
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
      filters: {
        enabled: true,
        fields: {},
      },
      sorts: {
        default: 'MATCH_SCORE',
        options: ['MATCH_SCORE', 'NICKNAME'],
      },
    },
    availabilityNotices: [],
  };
}

function createRoommateSearchResponse() {
  return {
    ...createRoommateManifestResponse(),
    appliedSort: 'MATCH_SCORE',
    resultSummary: {
      summaryOnlyCount: 0,
      detailViewableCount: 0,
      scoreVisibleCount: 0,
    },
    pageInfo: {
      hasNextPage: false,
      nextCursor: null,
    },
    items: [],
  };
}

function stubClientFetch(json: unknown, status = 200) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function firstClientFetchUrl(fetchMock: ReturnType<typeof stubClientFetch>): URL {
  const input = fetchMock.mock.calls[0]?.[0];
  if (!input) throw new Error('fetch was not called');
  return new URL(String(input), 'http://localhost');
}

function stubRawClientFetch(body: string, status = 200) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('roommateSearch client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('search client는 same-origin BFF를 호출하고 schema parse된 response를 반환한다', async () => {
    const fetchMock = stubClientFetch(createRoommateSearchResponse());

    const result = await getRoommateSearch({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      'college.values[]': ['ENGINEERING', 'HUMANITIES'],
      'mbtiTraits.energy': 'E',
    });
    const url = firstClientFetchUrl(fetchMock);

    expect(url.pathname).toBe('/api/roommate-search');
    expect(url.origin).toBe('http://localhost');
    expect(url.searchParams.get('scope')).toBe('SAME_BUILDING_ONLY');
    expect(url.searchParams.getAll('college.values[]')).toEqual(['ENGINEERING', 'HUMANITIES']);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ cache: 'no-store' }));
    expect(result.scope).toBe('SAME_BUILDING_ONLY');
  });

  it('manifest client는 same-origin manifest BFF를 호출한다', async () => {
    const fetchMock = stubClientFetch(createRoommateManifestResponse());

    const result = await getRoommateSearchManifest({ scope: 'SAME_BUILDING_ONLY' });
    const url = firstClientFetchUrl(fetchMock);

    expect(url.pathname).toBe('/api/roommate-search/manifest');
    expect(url.searchParams.get('scope')).toBe('SAME_BUILDING_ONLY');
    expect(result.manifest.scope).toBe('SAME_BUILDING_ONLY');
  });

  it('BFF non-ok JSON code를 safe RoommateApiError로 normalize한다', async () => {
    stubClientFetch(
      {
        success: false,
        code: 'INVALID_ROOMMATE_SEARCH_QUERY',
        message: 'raw upstream message',
      },
      400,
    );

    await expect(getRoommateSearch()).rejects.toMatchObject({
      code: 'INVALID_ROOMMATE_SEARCH_QUERY',
      status: 400,
      retryable: false,
    });
  });

  it('schema invalid response를 safe schema error로 normalize한다', async () => {
    stubClientFetch({ scope: 'SAME_BUILDING_ONLY' });

    await expect(getRoommateSearch()).rejects.toMatchObject({
      code: 'ROOMMATE_SEARCH_SCHEMA_INVALID',
      status: 200,
      retryable: true,
    });
  });

  it('malformed JSON response를 safe schema error로 normalize한다', async () => {
    stubRawClientFetch('not-json');

    await expect(getRoommateSearch()).rejects.toMatchObject({
      code: 'ROOMMATE_SEARCH_SCHEMA_INVALID',
      status: 200,
      retryable: true,
    });
  });

  it('fetch throw를 retryable network error로 normalize한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    try {
      await getRoommateSearchManifest();
      throw new Error('expected request to fail');
    } catch (error) {
      expect(isRoommateApiError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'ROOMMATE_SEARCH_NETWORK_ERROR',
        retryable: true,
      });
    }
  });
});

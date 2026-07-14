import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { GET as getRoommateSearch } from '../roommate-search/route';
import { GET as getRoommateSearchManifest } from '../roommate-search/manifest/route';

const AUTH_TOKEN = `v1.session-roommate-search.${'a'.repeat(43)}`;

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
        fields: {
          college: {
            enabled: true,
            source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
            operators: ['INCLUDE', 'EXCLUDE'],
            options: [{ code: 'ENGINEERING', label: '공과대학' }],
          },
          minScore: {
            enabled: true,
            source: 'MATCH_SCORE_PRESET',
            options: [{ code: '80', label: '80점 이상' }],
          },
        },
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
      detailViewableCount: 1,
      scoreVisibleCount: 1,
    },
    pageInfo: {
      hasNextPage: true,
      nextCursor: 'cursor-next',
    },
    items: [
      {
        id: 'participant-1',
        sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
        relation: { type: 'GENERAL' },
        exposure: {
          listSummaryVisible: true,
          detailViewable: true,
          canViewFull: true,
          scoreVisible: true,
        },
        actions: {
          canBookmark: true,
          canRequestMatch: true,
          canStartChat: false,
          unavailableReasons: [],
        },
        resultRead: {
          resultReadable: false,
          context: 'NONE',
        },
        profileSummary: {
          nickname: '테스트룸메',
          intro: '조용한 생활을 선호해요.',
          smokingBehavior: 'NO',
          sleepHabit: 'NONE',
          relationshipStyle: 'CASUAL',
        },
        bookmark: {
          bookmarked: true,
          bookmarkedAt: '2026-07-06T00:00:00.000Z',
        },
        detailEntryToken: 'detail-entry-token-1',
        matchScore: 88,
      },
    ],
  };
}

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('roommate-search BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('search route는 auth cookie, allowed dotted query, repeated array query만 upstream으로 전달하고 success schema를 검증한다', async () => {
    const fetchMock = stubJsonFetch(createRoommateSearchResponse());
    const request = createRequest(
      '/api/roommate-search?scope=SAME_BUILDING_ONLY&sort=MATCH_SCORE&limit=20&college.operator=EXCLUDE&college.values%5B%5D=ENGINEERING&college.values%5B%5D=HUMANITIES&mbtiTraits.energy=E&unknown=drop-me',
      {
        headers: {
          Cookie: `auth-token=${AUTH_TOKEN}`,
          Authorization: 'Bearer caller-supplied-token',
          'x-api-key': 'caller-api-key',
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'vitest',
        },
      },
    );

    const response = await getRoommateSearch(request);
    const upstreamUrl = new URL(firstFetchInput(fetchMock));

    expect(upstreamUrl.origin).toBe('http://localhost:4000');
    expect(upstreamUrl.pathname).toBe('/api/roommate-search');
    expect(upstreamUrl.searchParams.get('scope')).toBe('SAME_BUILDING_ONLY');
    expect(upstreamUrl.searchParams.get('sort')).toBe('MATCH_SCORE');
    expect(upstreamUrl.searchParams.get('college.operator')).toBe('EXCLUDE');
    expect(upstreamUrl.searchParams.getAll('college.values[]')).toEqual([
      'ENGINEERING',
      'HUMANITIES',
    ]);
    expect(upstreamUrl.searchParams.get('mbtiTraits.energy')).toBe('E');
    expect(upstreamUrl.searchParams.has('unknown')).toBe(false);
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'vitest',
        }),
      }),
    );
    expect(firstFetchInit(fetchMock).headers).not.toMatchObject({
      'x-api-key': 'caller-api-key',
    });
    await expect(expectJson(response)).resolves.toMatchObject({
      scope: 'SAME_BUILDING_ONLY',
      appliedSort: 'MATCH_SCORE',
      items: [{ id: 'participant-1' }],
    });
  });

  it('manifest route는 auth cookie와 scope만 upstream으로 전달한다', async () => {
    const fetchMock = stubJsonFetch(createRoommateManifestResponse());
    const request = createRequest(
      '/api/roommate-search/manifest?scope=SAME_BUILDING_ONLY&sort=MATCH_SCORE&college.values%5B%5D=ENGINEERING',
      {
        headers: {
          Cookie: `auth-token=${AUTH_TOKEN}`,
          Authorization: 'Bearer caller-supplied-token',
        },
      },
    );

    const response = await getRoommateSearchManifest(request);
    const upstreamUrl = new URL(firstFetchInput(fetchMock));

    expect(upstreamUrl.pathname).toBe('/api/roommate-search/manifest');
    expect(upstreamUrl.searchParams.get('scope')).toBe('SAME_BUILDING_ONLY');
    expect(upstreamUrl.searchParams.has('sort')).toBe(false);
    expect(upstreamUrl.searchParams.has('college.values[]')).toBe(false);
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    await expect(expectJson(response)).resolves.toMatchObject({
      manifest: { scope: 'SAME_BUILDING_ONLY' },
    });
  });

  it('upstream success schema drift는 fail-closed 502로 변환한다', async () => {
    stubJsonFetch({ scope: 'SAME_BUILDING_ONLY' });
    const response = await getRoommateSearch(
      createRequest('/api/roommate-search', { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } }),
    );

    expect(response.status).toBe(502);
    await expect(expectJson(response)).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('upstream unavailable은 safe 502로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const response = await getRoommateSearchManifest(
      createRequest('/api/roommate-search/manifest', {
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
    );

    expect(response.status).toBe(502);
    await expect(expectJson(response)).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_UNAVAILABLE',
    });
  });

  it('upstream domain error는 success schema parse 없이 status/body를 유지하고 민감 body field를 redaction한다', async () => {
    stubJsonFetch(
      {
        success: false,
        code: 'INVALID_ROOMMATE_SEARCH_QUERY',
        message: '룸메이트 찾기 검색 조건이 올바르지 않습니다.',
        accessToken: 'must-not-leak',
        nested: { cookie: 'must-not-leak', reason: 'stale query' },
      },
      400,
    );

    const response = await getRoommateSearch(
      createRequest('/api/roommate-search?scope=CAMPUS_MERGED&minScore=80', {
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
    );

    expect(response.status).toBe(400);
    const json = await expectJson(response);
    expect(json).toMatchObject({
      success: false,
      code: 'INVALID_ROOMMATE_SEARCH_QUERY',
      nested: { reason: 'stale query' },
    });
    expect(json).not.toHaveProperty('accessToken');
    expect(json.nested).not.toHaveProperty('cookie');
  });

  it('upstream non-json body는 sensitive body를 노출하지 않고 safe code로 닫는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('token=secret', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
      ),
    );

    const response = await getRoommateSearch(
      createRequest('/api/roommate-search', { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } }),
    );

    expect(response.status).toBe(502);
    await expect(expectJson(response)).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
    });
  });
});

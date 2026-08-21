import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { POST as requestUnmatch } from '../matches/active/[id]/unmatch-request/route';
import { POST as cancelUnmatchRequest } from '../matches/active/[id]/unmatch-request/cancel/route';
import { GET as getMatchHistory } from '../matches/history/route';
import { GET as getMatchHistoryCounterpartProfile } from '../matches/history/entries/[entryId]/counterpart-profile/route';
import { POST as createMatchRequest } from '../matches/requests/route';
import { GET as getMatchOverview } from '../matches/overview/route';
import { GET as getActiveMatch } from '../matches/active/route';
import { GET as getMatchRequests } from '../matches/requests/route';
import { POST as acceptMatchRequest } from '../matches/requests/[id]/accept/route';

const AUTH_TOKEN = `v1.session-matches.${'a'.repeat(43)}`;
const matchesBffRoot = join(process.cwd(), 'src/app/api/matches');

function matchBffRouteFiles(root = matchesBffRoot): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return matchBffRouteFiles(path);
    }
    return entry.isFile() && entry.name === 'route.ts' ? [relative(matchesBffRoot, path)] : [];
  });
}

function createMatchRequestActionResponse() {
  const serverTime = '2026-06-08T00:00:00.000Z';
  return {
    request: {
      id: 'request-1',
      seasonId: 'season-1',
      direction: 'SENT',
      counterpartUserId: 'target-1',
      counterpartParticipantId: 'participant-target-1',
      counterpartSummary: {
        id: 'target-1',
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
        resultRead: { resultReadable: false, context: 'NONE' },
        profileSummary: {
          nickname: '테스트 룸메이트',
          intro: '조용한 생활을 선호해요.',
          smokingBehavior: 'NO',
          sleepHabit: 'NONE',
          relationshipStyle: 'CASUAL',
        },
        bookmark: { bookmarked: false },
        detailEntryToken: 'detail-token-1',
        matchScore: 88,
      },
      status: 'PENDING',
      note: '잘 부탁해요.',
      createdAt: serverTime,
      expiresAt: '2026-06-13T00:00:00.000Z',
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
    },
    activeMatch: null,
  };
}

function createActiveMatchActionResponse() {
  return {
    activeMatch: {
      id: 'active-1',
      seasonId: 'season-1',
      counterpartUserId: 'target-1',
      counterpartParticipantId: 'participant-target-1',
      counterpartNickname: '테스트 룸메이트',
      status: 'ACTIVE',
      startedAt: '2026-06-08T00:00:00.000Z',
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      unmatchProgress: {
        state: 'WAITING_FOR_COUNTERPART',
        requestedByViewerAt: '2026-06-08T00:00:00.000Z',
        requestedByCounterpartAt: null,
        progressCount: 1,
        requiredCount: 2,
        canRequest: false,
        canCancel: true,
        disabledReason: null,
        availableUntil: '2026-06-13T00:00:00.000Z',
      },
    },
  };
}

describe('matches BFF forwarding routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pair-only product contract에는 group BFF route가 없다', () => {
    expect(existsSync(join(matchesBffRoot, 'groups'))).toBe(false);
    expect(matchBffRouteFiles().sort()).toEqual([
      'active/[id]/unmatch-request/cancel/route.ts',
      'active/[id]/unmatch-request/route.ts',
      'active/route.ts',
      'history/entries/[entryId]/counterpart-profile/route.ts',
      'history/route.ts',
      'overview/route.ts',
      'requests/[id]/accept/route.ts',
      'requests/[id]/cancel/route.ts',
      'requests/[id]/reject/route.ts',
      'requests/route.ts',
    ]);
  });

  it('active match unmatch request/cancel route는 protected forwarding으로 path segment를 encode한다', async () => {
    const requestFetchMock = stubJsonFetch(createActiveMatchActionResponse());
    const requestInput = createRequest('/api/matches/active/active%201%2F2/unmatch-request', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await requestUnmatch(requestInput, { params: Promise.resolve({ id: 'active 1/2' }) });

    expect(firstFetchInput(requestFetchMock)).toBe(
      'http://localhost:4000/api/matches/active/active%201%2F2/unmatch-request',
    );
    expect(firstFetchInit(requestFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(requestFetchMock)).not.toHaveProperty('body');

    vi.unstubAllGlobals();
    const cancelFetchMock = stubJsonFetch(createActiveMatchActionResponse());
    const cancelInput = createRequest('/api/matches/active/active%201%2F2/unmatch-request/cancel', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await cancelUnmatchRequest(cancelInput, { params: Promise.resolve({ id: 'active 1/2' }) });

    expect(firstFetchInput(cancelFetchMock)).toBe(
      'http://localhost:4000/api/matches/active/active%201%2F2/unmatch-request/cancel',
    );
    expect(firstFetchInit(cancelFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(cancelFetchMock)).not.toHaveProperty('body');
  });

  it('overview, active read, request list/action route는 authenticated schema-validated upstream path를 사용한다', async () => {
    const overviewFetch = stubJsonFetch({
      serverNow: '2026-02-10T03:00:00.000Z',
      season: {
        id: 'season-1',
        state: 'SEASON_MATCHING',
        roomSelectionDate: '2026-02-11',
        seasonEndDate: '2026-02-28',
      },
      capability: { canViewMatching: true, reason: null },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
      activity: [],
    });
    await expect(
      getMatchOverview(
        createRequest('/api/matches/overview', { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } }),
      ),
    ).resolves.toHaveProperty('status', 200);
    expect(firstFetchInput(overviewFetch)).toBe('http://localhost:4000/api/matches/overview');
    expect(firstFetchInit(overviewFetch)).toEqual(
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );

    vi.unstubAllGlobals();
    const activeFetch = stubJsonFetch({ activeMatch: null });
    await getActiveMatch(
      createRequest('/api/matches/active', { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } }),
    );
    expect(firstFetchInput(activeFetch)).toBe('http://localhost:4000/api/matches/active');

    vi.unstubAllGlobals();
    const listFetch = stubJsonFetch({ items: [] });
    await getMatchRequests(
      createRequest('/api/matches/requests', { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } }),
    );
    expect(firstFetchInput(listFetch)).toBe('http://localhost:4000/api/matches/requests');

    vi.unstubAllGlobals();
    const acceptFetch = stubJsonFetch(createMatchRequestActionResponse());
    await acceptMatchRequest(
      createRequest('/api/matches/requests/request%201/accept', {
        method: 'POST',
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
      { params: Promise.resolve({ id: 'request 1' }) },
    );
    expect(firstFetchInput(acceptFetch)).toBe(
      'http://localhost:4000/api/matches/requests/request%201/accept',
    );

    vi.unstubAllGlobals();
    const historyFetch = stubJsonFetch({ entries: [] });
    await getMatchHistory(
      createRequest('/api/matches/history', { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } }),
    );
    expect(firstFetchInput(historyFetch)).toBe('http://localhost:4000/api/matches/history');

    vi.unstubAllGlobals();
    const profileFetch = stubJsonFetch({
      id: 'target-1',
      nickname: '테스트 룸메이트',
      intro: '조용한 생활을 선호해요.',
      smokingBehavior: 'NO',
      sleepHabit: 'NONE',
      relationshipStyle: 'CASUAL',
    });
    await getMatchHistoryCounterpartProfile(
      createRequest('/api/matches/history/entries/entry%201/counterpart-profile', {
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
      { params: Promise.resolve({ entryId: 'entry 1' }) },
    );
    expect(firstFetchInput(profileFetch)).toBe(
      'http://localhost:4000/api/matches/history/entries/entry%201/counterpart-profile',
    );
  });

  it('match request create route는 protected JSON forwarding과 success schema parse를 수행한다', async () => {
    const fetchMock = stubJsonFetch(createMatchRequestActionResponse());
    const body = { targetUserId: 'target-1', note: '잘 부탁해요.' };
    const request = createRequest('/api/matches/requests', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const response = await createMatchRequest(request);

    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/matches/requests');
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      request: { id: 'request-1', status: 'PENDING' },
      activeMatch: null,
    });
  });

  it('match request create route는 upstream success schema drift를 fail-closed 처리한다', async () => {
    const fetchMock = stubJsonFetch({ request: { id: 'request-1' }, activeMatch: null });
    const request = createRequest('/api/matches/requests', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      body: JSON.stringify({ targetUserId: 'target-1' }),
    });

    const response = await createMatchRequest(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('unmatch action route도 success schema drift를 fail-closed 처리한다', async () => {
    stubJsonFetch({ activeMatch: { id: 'active-1' } });
    const response = await requestUnmatch(
      createRequest('/api/matches/active/active-1/unmatch-request', {
        method: 'POST',
        headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      }),
      { params: Promise.resolve({ id: 'active-1' }) },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('match request create route는 domain error를 success schema로 parse하지 않고 redaction한다', async () => {
    const fetchMock = stubJsonFetch(
      {
        success: false,
        code: 'MATCH_REQUEST_NOT_ALLOWED',
        message: '현재 상태에서는 매칭 요청을 생성할 수 없습니다.',
        accessToken: 'secret-token',
      },
      409,
    );
    const request = createRequest('/api/matches/requests', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
      body: JSON.stringify({ targetUserId: 'target-1' }),
    });

    const response = await createMatchRequest(request);
    const json = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(409);
    expect(json).toMatchObject({ code: 'MATCH_REQUEST_NOT_ALLOWED' });
    expect(json).not.toHaveProperty('accessToken');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { POST as requestUnmatch } from '../matches/active/[id]/unmatch-request/route';
import { POST as cancelUnmatchRequest } from '../matches/active/[id]/unmatch-request/cancel/route';
import { POST as createMatchRequest } from '../matches/requests/route';

const AUTH_TOKEN = `v1.session-matches.${'a'.repeat(43)}`;

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

describe('matches BFF forwarding routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('active match unmatch request/cancel route는 protected forwarding으로 path segment를 encode한다', async () => {
    const requestFetchMock = stubJsonFetch({ activeMatch: { id: 'active 1/2' } });
    const requestInput = createRequest('/api/matches/active/active%201%2F2/unmatch-request', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await requestUnmatch(requestInput, { params: { id: 'active 1/2' } });

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
    const cancelFetchMock = stubJsonFetch({ activeMatch: { id: 'active 1/2' } });
    const cancelInput = createRequest('/api/matches/active/active%201%2F2/unmatch-request/cancel', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await cancelUnmatchRequest(cancelInput, { params: { id: 'active 1/2' } });

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

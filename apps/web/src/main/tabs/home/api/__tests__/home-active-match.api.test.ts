import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeActiveMatchApi, HomeActiveMatchActionError } from '../home-active-match.api';

function stubFetch(status = 204, json: unknown = null) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (json === null) {
      return new Response(null, { status });
    }

    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('homeActiveMatchApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('active match 해제 요청 route를 encode해서 호출한다', async () => {
    const fetchMock = stubFetch();

    await expect(homeActiveMatchApi.requestUnmatch('match 1/2')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith('/api/matches/active/match%201%2F2/unmatch-request', {
      method: 'POST',
    });
  });

  it('active match 해제 요청 철회 route를 호출한다', async () => {
    const fetchMock = stubFetch();

    await expect(
      homeActiveMatchApi.cancelUnmatchRequest('active-match-1'),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matches/active/active-match-1/unmatch-request/cancel',
      { method: 'POST' },
    );
  });

  it('upstream error message를 safe error로 전달한다', async () => {
    stubFetch(409, { message: '이미 해제 요청을 처리했어요.' });

    await expect(homeActiveMatchApi.requestUnmatch('active-match-1')).rejects.toMatchObject({
      name: 'HomeActiveMatchActionError',
      code: 'HOME_ACTIVE_MATCH_ACTION_REQUEST_FAILED',
      message: '이미 해제 요청을 처리했어요.',
      status: 409,
    } satisfies Partial<HomeActiveMatchActionError>);
  });

  it('network failure는 safe fallback message로 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    );

    await expect(homeActiveMatchApi.requestUnmatch('active-match-1')).rejects.toMatchObject({
      code: 'HOME_ACTIVE_MATCH_ACTION_UPSTREAM_UNAVAILABLE',
      message: '매칭 해제 요청을 처리하지 못했어요.',
    } satisfies Partial<HomeActiveMatchActionError>);
  });
});

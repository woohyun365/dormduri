import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchingApiError, matchingApi } from '../matching.api';

describe('matchingApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('overview을 shared schema로 parse하고 AbortSignal을 전달한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          serverNow: '2026-02-10T03:00:00.000Z',
          season: { id: 'season-1', state: 'SEASON_MATCHING', roomSelectionDate: '2026-02-11' },
          capability: { canViewMatching: true, reason: null },
          sentRequests: [],
          receivedRequests: [],
          activeMatch: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(matchingApi.getOverview(controller.signal)).resolves.toMatchObject({
      season: { state: 'SEASON_MATCHING' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matches/overview',
      expect.objectContaining({ method: 'GET', signal: controller.signal }),
    );
  });

  it('schema drift와 stale action response를 public feature error로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ serverNow: 'bad' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: false, message: 'raw upstream message' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    );

    await expect(matchingApi.getOverview()).rejects.toMatchObject({
      code: 'MATCHING_API_RESPONSE_INVALID',
    });
    await expect(matchingApi.acceptRequest('request-1')).rejects.toMatchObject({
      code: 'MATCHING_API_STATE_CHANGED',
    });

    await expect(matchingApi.acceptRequest('request-1')).rejects.not.toThrow(
      'raw upstream message',
    );
  });

  it('AbortError를 public abort error로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    );

    await expect(matchingApi.getOverview()).rejects.toEqual(
      expect.objectContaining<Partial<MatchingApiError>>({ code: 'MATCHING_API_ABORTED' }),
    );
  });
});

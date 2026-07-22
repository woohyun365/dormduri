import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPreviousSeasonProfileResponse,
  createPublicProfileFull,
} from '@/test/home-profile-detail-fixtures';
import { MatchingApiError, matchingApi } from '../matching.api';

describe('matchingApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('overview을 shared schema로 parse하고 AbortSignal을 전달한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
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

  it('history detail의 server eligibility error는 raw body 없이 non-retry public error로 정규화한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            code: 'MATCH_HISTORY_PROFILE_NOT_AVAILABLE',
            detail: 'raw',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(matchingApi.getHistoryCounterpartProfile('entry 1/2')).rejects.toMatchObject({
      code: 'MATCHING_HISTORY_DETAIL_UNAVAILABLE',
      message: '이 기록의 상대 프로필은 더 이상 확인할 수 없어요.',
    });
  });

  it('history detail은 entry id를 encode한 result-read route만 호출한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(createPublicProfileFull()));
    vi.stubGlobal('fetch', fetchMock);

    await matchingApi.getHistoryCounterpartProfile('entry 1/2');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matches/history/entries/entry%201%2F2/counterpart-profile',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('history self profile은 season id를 encode한 viewer-owned route를 호출한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json(createPreviousSeasonProfileResponse()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(matchingApi.getHistorySelfProfile('season 2026/1')).resolves.toMatchObject({
      detailState: 'FULL',
      seasonId: 'season-2026-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/seasons/season%202026%2F1/profile/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

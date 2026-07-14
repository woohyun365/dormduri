import { describe, expect, it } from 'vitest';
import { MatchingApiError } from '../../api/matching.api';
import {
  getDisabledReasonDescriptionId,
  matchActionDisabledReasonCopy,
  matchCapabilityReasonCopy,
} from '../matching-action-capability';
import { getRequestCountdown } from '../request-time';
import { toMatchingViewState } from '../matching-view-model';

function overview(state: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH') {
  return {
    serverNow: '2026-08-01T00:00:00.000Z',
    season: { id: 's1', state, roomSelectionDate: null },
    capability: { canViewMatching: true, reason: null },
    sentRequests: [],
    receivedRequests: [],
    activeMatch: null,
  } as const;
}

describe('matching view model', () => {
  it.each([
    ['OFF_SEASON', 'off-season'],
    ['SEASON_OPEN', 'season-open'],
    ['SEASON_MATCHING', 'season-matching'],
    ['SEASON_POST_MATCH', 'season-post-match'],
  ] as const)('모든 official season state를 명시적으로 모델링한다: %s', (state, kind) => {
    expect(toMatchingViewState({ overview: overview(state) as never })).toMatchObject({ kind });
  });

  it('loading, public error와 capability denied를 silent fallback 없이 분리한다', () => {
    expect(toMatchingViewState({ loading: true })).toEqual({ kind: 'loading' });
    expect(
      toMatchingViewState({ error: new MatchingApiError('MATCHING_API_NETWORK') }),
    ).toMatchObject({ kind: 'error' });
    expect(
      toMatchingViewState({
        overview: {
          ...overview('SEASON_MATCHING'),
          capability: { canViewMatching: false, reason: 'VIEWER_NOT_REGISTERED' },
        } as never,
      }),
    ).toEqual({ kind: 'unavailable', reason: 'VIEWER_NOT_REGISTERED' });
    expect(() =>
      toMatchingViewState({
        overview: {
          ...overview('SEASON_MATCHING'),
          capability: { canViewMatching: false, reason: null },
        } as never,
      }),
    ).toThrow('requires a reason');
  });

  it('disabled reason copy와 description id는 exhaustive하고 stable하다', () => {
    expect(matchCapabilityReasonCopy('VIEWER_NOT_ASSIGNED')).toContain('기숙사');
    expect(matchActionDisabledReasonCopy('REQUEST_EXPIRED')).toContain('유효 시간');
    expect(
      getDisabledReasonDescriptionId({ actionId: 'request-1', reason: 'REQUEST_EXPIRED' }),
    ).toBe('matching-action-request-1-reason-request_expired');
  });

  it('fixed server clock 경계에서 request countdown을 계산한다', () => {
    expect(
      getRequestCountdown({
        serverNow: '2026-08-01T00:00:00.000Z',
        expiresAt: '2026-08-01T01:01:00.000Z',
      }),
    ).toEqual({ kind: 'remaining', totalSeconds: 3660, label: '1시간 1분 남음' });
    expect(
      getRequestCountdown({
        serverNow: '2026-08-01T00:00:00.000Z',
        expiresAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toEqual({ kind: 'expired' });
  });

  it('unknown history result를 성공으로 추측하지 않고 aggregate에서 제외한다', () => {
    const state = toMatchingViewState({
      overview: overview('OFF_SEASON') as never,
      history: {
        items: [
          { finalResult: 'NO_MATCH' },
          { finalResult: 'MATCHED_SUCCESS' },
          { finalResult: 'UNMATCHED_AFTER_SUCCESS' },
        ],
      } as never,
    });
    expect(state).toMatchObject({
      kind: 'off-season',
      historySummary: { seasons: 3, matchedCount: 1, unmatchedCount: 1 },
    });
  });
});

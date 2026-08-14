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
    season: { id: 's1', state, roomSelectionDate: null, seasonEndDate: '2026-08-31' },
    capability: { canViewMatching: true, reason: null },
    sentRequests: [],
    receivedRequests: [],
    activeMatch: null,
    activity: [],
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

  it('current request 관리에는 pending만 두고 terminal result는 활동 이력으로 분리한다', () => {
    const state = toMatchingViewState({
      overview: {
        ...overview('SEASON_MATCHING'),
        sentRequests: [
          {
            id: 'request-ended',
            status: 'REJECTED',
          },
        ],
        activity: [
          {
            id: 'request:request-ended',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '봄날',
            stage: 'SENT_REQUEST',
            result: 'REQUEST_REJECTED',
            direction: 'SENT',
            occurredAt: '2026-08-02T03:00:00.000Z',
            requestTerminalReason: 'REJECTED_BY_RECEIVER',
            systemCancellationCause: null,
            systemCancellationGroupId: null,
            activeMatchEndReason: null,
          },
        ],
      } as never,
    });

    expect(state).toMatchObject({
      kind: 'season-matching',
      current: {
        requestSection: { sent: [] },
        activity: [{ kind: 'entry', entry: { title: '요청 거절' } }],
      },
    });
  });

  it('Post Match도 overview current activity를 read-only result와 함께 유지한다', () => {
    const state = toMatchingViewState({
      overview: {
        ...overview('SEASON_POST_MATCH'),
        activity: [
          {
            id: 'request:request-ended',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '봄날',
            stage: 'SENT_REQUEST',
            result: 'REQUEST_REJECTED',
            direction: 'SENT',
            occurredAt: '2026-08-02T03:00:00.000Z',
            requestTerminalReason: 'REJECTED_BY_RECEIVER',
            systemCancellationCause: null,
            systemCancellationGroupId: null,
            activeMatchEndReason: null,
          },
        ],
      } as never,
    });

    expect(state).toMatchObject({
      kind: 'season-post-match',
      activity: [{ kind: 'entry', entry: { title: '요청 거절' } }],
    });
  });

  it('철회 viewer는 current action 대신 viewer-owned activity read state로 분리한다', () => {
    const state = toMatchingViewState({
      overview: {
        ...overview('SEASON_MATCHING'),
        capability: { canViewMatching: false, reason: 'VIEWER_DEREGISTERED' },
        activity: [
          {
            id: 'request:withdrawn',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '봄날',
            stage: 'SENT_REQUEST',
            result: 'REQUEST_CANCELLED',
            direction: 'SENT',
            occurredAt: '2026-08-02T03:00:00.000Z',
            requestTerminalReason: 'WITHDRAWN_PARTICIPANT',
            systemCancellationCause: null,
            systemCancellationGroupId: null,
            activeMatchEndReason: null,
          },
        ],
      } as never,
    });

    expect(state).toMatchObject({
      kind: 'deregistered',
      seasonState: 'SEASON_MATCHING',
      activity: [{ kind: 'auto-closed-group', cause: 'PARTICIPATION_CANCELLED' }],
    });
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
    ).toMatchObject({
      kind: 'unavailable',
      reason: 'VIEWER_NOT_REGISTERED',
      seasonState: 'SEASON_MATCHING',
    });
    expect(() =>
      toMatchingViewState({
        overview: {
          ...overview('SEASON_MATCHING'),
          capability: { canViewMatching: false, reason: null },
        } as never,
      }),
    ).toThrow('requires a reason');
  });

  it('authoritative refetch 중 기존 overview가 있으면 request shell을 unmount하지 않는다', () => {
    expect(
      toMatchingViewState({ loading: true, overview: overview('SEASON_MATCHING') as never }),
    ).toMatchObject({ kind: 'season-matching' });
  });

  it('disabled reason copy와 description id는 exhaustive하고 stable하다', () => {
    expect(matchCapabilityReasonCopy('VIEWER_NOT_REGISTERED')).toContain('시즌 참여 등록');
    expect(matchActionDisabledReasonCopy('REQUEST_EXPIRED')).toContain('유효 시간');
    expect(
      getDisabledReasonDescriptionId({ actionId: 'request-1', reason: 'REQUEST_EXPIRED' }),
    ).toBe('matching-action-request-1-reason-request_expired');
  });

  it.each([
    'SEASON_NOT_ACTIONABLE',
    'ROOM_SELECTION_CUTOFF',
    'REQUEST_EXPIRED',
    'REQUEST_ALREADY_RESOLVED',
    'MATCH_PRECONDITION_FAILED',
    'ACTIVE_MATCH_NOT_ACTIONABLE',
    'UNMATCH_ALREADY_PENDING',
    'TARGET_UNAVAILABLE',
  ] as const)('public action disabled reason matrix를 누락 없이 제공한다: %s', (reason) => {
    expect(matchActionDisabledReasonCopy(reason)).not.toHaveLength(0);
    expect(getDisabledReasonDescriptionId({ actionId: 'request-1', reason })).toBe(
      `matching-action-request-1-reason-${reason.toLowerCase()}`,
    );
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

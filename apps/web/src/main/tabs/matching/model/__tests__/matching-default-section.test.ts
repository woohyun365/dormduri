import { describe, expect, it } from 'vitest';
import { getMatchingDefaultSection } from '../matching-default-section';
import type { MatchingViewState } from '../matching-view-model';

describe('getMatchingDefaultSection', () => {
  it.each(['off-season', 'season-open'] as const)(
    '%s는 지난 기록을 기본 진입점으로 사용한다',
    (kind) => {
      expect(
        getMatchingDefaultSection({
          kind,
          historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
        }),
      ).toBe('past');
    },
  );

  it.each<MatchingViewState>([
    { kind: 'loading' },
    {
      kind: 'unavailable',
      reason: 'VIEWER_NOT_REGISTERED',
      seasonState: 'SEASON_MATCHING',
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
    },
    {
      kind: 'season-matching',
      current: {
        activeMatch: null,
        serverNow: '2026-08-01T00:00:00.000Z',
        roomSelectionDate: null,
        seasonEndDate: '2026-08-31',
        requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
        receivedPendingCount: 0,
        activity: [],
      },
    },
    {
      kind: 'season-post-match',
      activeMatch: null,
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
      activity: [],
    },
  ])('$kind는 현재 매칭을 기본 진입점으로 사용한다', (state) => {
    expect(getMatchingDefaultSection(state)).toBe('current');
  });

  it('철회 상태는 준비 기간에는 history, 활동이 있었던 phase에는 current를 기본으로 연다', () => {
    const historySummary = { seasons: 1, matchedCount: 0, unmatchedCount: 0 } as const;
    expect(
      getMatchingDefaultSection({
        kind: 'deregistered',
        seasonState: 'SEASON_OPEN',
        historySummary,
        activity: [],
      }),
    ).toBe('past');
    expect(
      getMatchingDefaultSection({
        kind: 'deregistered',
        seasonState: 'SEASON_POST_MATCH',
        historySummary,
        activity: [],
      }),
    ).toBe('current');
  });
});

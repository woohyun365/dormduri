import { describe, expect, it } from 'vitest';
import { MatchingApiError } from '../../api/matching.api';
import { toMatchingShellPresentation } from '../matching-shell-presentation';

describe('matching shell presentation', () => {
  it.each([
    [
      { kind: 'loading' } as const,
      { tone: 'neutral', statusLabel: '상태 확인 중', title: '매칭 정보를 준비하고 있어요' },
    ],
    [
      {
        kind: 'unavailable',
        reason: 'VIEWER_NOT_REGISTERED',
        seasonState: 'SEASON_MATCHING',
        historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
      } as const,
      { tone: 'neutral', statusLabel: '이용 조건 확인', title: '현재 매칭 이용 안내' },
    ],
    [
      {
        kind: 'off-season',
        historySummary: { seasons: 2, matchedCount: 1, unmatchedCount: 0 },
      } as const,
      { tone: 'neutral', statusLabel: '비시즌', title: '다음 매칭 시즌을 준비하고 있어요' },
    ],
    [
      {
        kind: 'season-open',
        historySummary: { seasons: 2, matchedCount: 1, unmatchedCount: 0 },
      } as const,
      {
        tone: 'progress',
        statusLabel: '시즌 준비',
        title: '시즌 등록 후 매칭 기간을 기다려주세요',
      },
    ],
    [
      {
        kind: 'season-matching',
        current: {
          activeMatch: null,
          serverNow: '2026-08-01T00:00:00.000Z',
          roomSelectionDate: '2026-08-10',
          seasonEndDate: '2026-08-31',
          requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
          receivedPendingCount: 2,
          activity: [],
        },
      } as const,
      { tone: 'action', statusLabel: '매칭 진행 중', title: '받은 요청부터 확인해보세요' },
    ],
    [
      {
        kind: 'season-post-match',
        activeMatch: null,
        historySummary: { seasons: 2, matchedCount: 1, unmatchedCount: 0 },
        activity: [],
      } as const,
      { tone: 'success', statusLabel: '시즌 결과', title: '이번 시즌 결과를 확인하세요' },
    ],
  ])('state $0을 policy-neutral hero presentation으로 변환한다', (state, expected) => {
    const presentation = toMatchingShellPresentation({ state });

    expect(presentation.hero).toMatchObject(expected);
    expect(presentation.hero.description).not.toMatch(/[A-Z_]{3,}/);
    expect(presentation.rail.facts).not.toContain('group matching');
  });

  it('public error copy만 쓰고 raw error code를 hero/rail에 노출하지 않는다', () => {
    const presentation = toMatchingShellPresentation({
      state: { kind: 'error', error: new MatchingApiError('MATCHING_API_NETWORK') },
    });

    expect(presentation.hero).toMatchObject({
      tone: 'caution',
      statusLabel: '다시 확인',
      title: '매칭 정보를 다시 확인해주세요',
    });
    expect(JSON.stringify(presentation)).not.toContain('MATCHING_API_NETWORK');
  });

  it('season shell mismatch는 action을 합성하지 않는 refresh context로 닫는다', () => {
    const presentation = toMatchingShellPresentation({
      state: {
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
      consistency: { kind: 'mismatch', nextMismatchCount: 2 },
    });

    expect(presentation.hero).toMatchObject({ tone: 'caution', statusLabel: '상태 재확인' });
    expect(presentation.rail.facts.join(' ')).toContain('다시 확인');
    expect(JSON.stringify(presentation)).not.toContain('수락');
  });
});

import { describe, expect, it } from 'vitest';
import { createMatchHistoryResponse } from '@/test/home-profile-detail-fixtures';
import {
  canOpenMatchHistoryDetail,
  getVisibleHistorySeasonCount,
  toMatchingHistoryView,
} from '../matching-history-view';

describe('matching history view model', () => {
  it('API season ordering을 보존하고 최종 매칭만 detail 대상으로 만든다', () => {
    const response = createMatchHistoryResponse({
      items: [
        {
          ...createMatchHistoryResponse().items[0]!,
          seasonId: 'latest',
          seasonName: '최신 시즌',
          history: [
            createMatchHistoryResponse().items[0]!.history[0]!,
            {
              ...createMatchHistoryResponse().items[0]!.history[0]!,
              id: 'unmatched-entry',
              result: 'UNMATCHED_AFTER_SUCCESS',
              unmatchedAt: '2026-08-07T00:00:00.000Z',
              activeMatchEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
            },
          ],
        },
        { ...createMatchHistoryResponse().items[0]!, seasonId: 'older', seasonName: '이전 시즌' },
      ],
    });

    const view = toMatchingHistoryView(response);

    expect(view.map((season) => season.id)).toEqual(['latest', 'older']);
    expect(view[0]?.entries.map((entry) => entry.canOpenDetail)).toEqual([true, false]);
    expect(view[0]?.entries[1]).toMatchObject({
      resultLabel: '매칭 후 해제',
      description: '두 사람의 동의로 매칭이 해제되었어요.',
      directionLabel: '내가 보낸 요청',
      eventLabel: '해제일',
    });
    expect(canOpenMatchHistoryDetail(response.items[0]!.history[0]!)).toBe(true);
  });

  it.each([
    [0, 1, 0],
    [1, 1, 1],
    [3, 1, 3],
    [4, 1, 3],
    [7, 2, 6],
  ])('client reveal은 %i개 중 %i page에서 %i개만 보여준다', (total, pages, expected) => {
    expect(getVisibleHistorySeasonCount(total, pages)).toBe(expected);
  });
});

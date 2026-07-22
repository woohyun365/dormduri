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
      result: 'UNMATCHED_AFTER_SUCCESS',
      resultLabel: '매칭 후 해제',
      headline: '감자친구님과의 매칭이 종료되었어요',
      description: '두 사람의 동의로 매칭이 해제되었어요.',
      eventDateLabel: '2026. 8. 7.',
    });
    expect(view[0]?.result).toBe('MATCHED_SUCCESS');
    expect(canOpenMatchHistoryDetail(response.items[0]!.history[0]!)).toBe(true);
  });

  it('headline과 중복되는 요청 설명은 제거하고 원인 정보가 있는 event만 보조 문구를 남긴다', () => {
    const base = createMatchHistoryResponse().items[0]!;
    const rejected = {
      ...base.history[0]!,
      result: 'REQUEST_REJECTED' as const,
      requestTerminalReason: 'REJECTED_BY_RECEIVER' as const,
    };

    expect(
      toMatchingHistoryView({ items: [{ ...base, history: [rejected] }] })[0]?.entries[0],
    ).toMatchObject({
      headline: '감자친구님이 내 요청을 거절했어요',
      description: null,
    });
  });

  it('시즌 최종 결과는 성공 여부로 요약하고 매칭 해제는 timeline에만 유지한다', () => {
    const base = createMatchHistoryResponse().items[0]!;
    const response = createMatchHistoryResponse({
      items: [
        { ...base, seasonId: 'no-match', finalResult: 'NO_MATCH' },
        { ...base, seasonId: 'unmatched', finalResult: 'UNMATCHED_AFTER_SUCCESS' },
      ],
    });

    const view = toMatchingHistoryView(response);

    expect(view.map((season) => season.resultLabel)).toEqual(['매칭 미성사', '매칭 미성사']);
    expect(view[1]?.entries[0]?.resultLabel).toBe('매칭 완료');
  });

  it('시스템 active match 확정으로 종료된 요청을 상대 취소로 잘못 표현하지 않는다', () => {
    const base = createMatchHistoryResponse().items[0]!;
    const response = createMatchHistoryResponse({
      items: [
        {
          ...base,
          history: [
            {
              ...base.history[0]!,
              result: 'REQUEST_CANCELLED',
              stage: 'RECEIVED_REQUEST',
              viewerRequested: false,
              requestTerminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
              systemCancellationCause: 'COUNTERPART_MATCHED',
              systemCancellationGroupId: 'active-match-counterpart',
            },
          ],
        },
      ],
    });

    expect(toMatchingHistoryView(response)[0]?.entries[0]).toMatchObject({
      headline: '감자친구님의 요청이 자동으로 종료되었어요',
      resultLabel: '요청 자동 종료',
      description: '상대 매칭 확정으로 정리됐어요.',
      requestTerminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
      systemCancellationCause: 'COUNTERPART_MATCHED',
      systemCancellationGroupId: 'active-match-counterpart',
    });
  });

  it('chat owner의 시즌별 대화 상대 수를 seasonId로 합성한다', () => {
    const response = createMatchHistoryResponse();

    const view = toMatchingHistoryView(response, {
      current: null,
      past: [
        {
          seasonId: response.items[0]!.seasonId,
          seasonName: response.items[0]!.seasonName,
          conversationUserCount: 4,
        },
      ],
    });

    expect(view[0]?.conversationUserCount).toBe(4);
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

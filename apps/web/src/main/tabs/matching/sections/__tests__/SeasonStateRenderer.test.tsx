import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeasonStateRenderer } from '../SeasonStateRenderer';

describe('SeasonStateRenderer', () => {
  it.each([
    [
      { kind: 'off-season', historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 } },
      '현재 매칭 요청은 열려 있지 않아요.',
    ],
    [
      { kind: 'season-open', historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 } },
      '현재 매칭 요청은 열려 있지 않아요.',
    ],
    [
      {
        kind: 'season-matching',
        current: {
          activeMatch: null,
          sentRequests: [],
          receivedRequests: [],
          receivedPendingCount: 2,
        },
      },
      '받은 요청 2건',
    ],
    [
      {
        kind: 'season-post-match',
        activeMatch: null,
        historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
      },
      '이번 시즌 매칭 결과가 없어요.',
    ],
  ])('official state를 공통 shell에 렌더링한다', (state, text) => {
    render(<SeasonStateRenderer state={state as never} />);
    expect(screen.getByRole('heading', { name: '매칭 현황' })).toBeInTheDocument();
    expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
  });
});

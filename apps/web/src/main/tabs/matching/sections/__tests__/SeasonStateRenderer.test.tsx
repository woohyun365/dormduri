import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeasonStateRenderer } from '../SeasonStateRenderer';

describe('SeasonStateRenderer', () => {
  it.each([
    [
      { kind: 'off-season', historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 } },
      '현재 매칭 요청은 쉬고 있어요',
    ],
    [
      { kind: 'season-open', historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 } },
      '매칭 프로필을 준비해주세요',
    ],
    [
      {
        kind: 'season-matching',
        current: {
          activeMatch: null,
          serverNow: '2026-08-01T00:00:00.000Z',
          roomSelectionDate: null,
          requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
          receivedPendingCount: 2,
        },
      },
      '현재 요청을 확인해보세요',
    ],
    [
      {
        kind: 'season-post-match',
        activeMatch: null,
        historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
      },
      '이번 시즌 매칭 결과가 없어요',
    ],
  ])('official state를 명시적 strategy component로 렌더링한다', (state, text) => {
    render(
      <SeasonStateRenderer
        state={state as never}
        requestCommands={{
          accept: async () => 'success' as const,
          reject: async () => 'success' as const,
          cancel: async () => 'success' as const,
          isPending: () => false,
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: text })).toBeInTheDocument();
  });
});

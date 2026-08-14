import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeregisteredMatchingState } from '../DeregisteredMatchingState';

const historySummary = { seasons: 1, matchedCount: 0, unmatchedCount: 0 } as const;

describe('DeregisteredMatchingState', () => {
  it('Season Open은 활동 이력을 합성하지 않고 참여 종료 gate만 제공한다', () => {
    render(
      <DeregisteredMatchingState
        seasonState="SEASON_OPEN"
        historySummary={historySummary}
        activity={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: '시즌 참여를 취소했어요' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '활동 이력' })).not.toBeInTheDocument();
  });

  it('Season Matching 이후에는 viewer-owned activity를 읽기 전용으로 제공한다', () => {
    render(
      <DeregisteredMatchingState
        seasonState="SEASON_MATCHING"
        historySummary={historySummary}
        activity={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: '활동 이력' })).toBeInTheDocument();
  });
});

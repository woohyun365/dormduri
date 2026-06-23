import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeQuickMenuSection } from '../HomeQuickMenuSection';
import type { SeasonState } from '@/types/season';

const handlers = {
  onNavigateList: vi.fn(),
  onNavigateMatching: vi.fn(),
  onNavigateMatchingHistory: vi.fn(),
  onNavigateChat: vi.fn(),
  onNavigateProfile: vi.fn(),
};

describe('Home season state matrix baseline', () => {
  it('documents that post-match currently falls through to the open-season quick menu shape', () => {
    render(<HomeQuickMenuSection {...handlers} seasonState={'SEASON_POST_MATCH' as SeasonState} />);

    expect(screen.getByText('룸메 찾기')).toBeInTheDocument();
    expect(screen.getByText('미리보기')).toBeInTheDocument();
    expect(screen.getByText('이전 기록')).toBeInTheDocument();
    expect(screen.getByText('시즌 중 이용')).toBeInTheDocument();
  });

  it.skip('target: post-match Home does not present new roommate search as a primary action', () => {
    render(<HomeQuickMenuSection {...handlers} seasonState={'SEASON_POST_MATCH' as SeasonState} />);

    expect(screen.queryByText('룸메 찾기')).not.toBeInTheDocument();
    expect(screen.getByText(/시즌 결과|이전 기록/)).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeQuickMenuSection } from '../sections/quick-actions/HomeQuickMenuSection';

const handlers = {
  onNavigateList: vi.fn(),
  onNavigateMatching: vi.fn(),
  onNavigateMatchingHistory: vi.fn(),
  onNavigateChat: vi.fn(),
  onNavigateProfile: vi.fn(),
};

describe('Home season state matrix baseline', () => {
  it('post-match Home does not present new roommate search as a primary action', () => {
    render(
      <HomeQuickMenuSection {...handlers} seasonState="SEASON_POST_MATCH" canStartChat={false} />,
    );

    expect(screen.queryByText('룸메 찾기')).not.toBeInTheDocument();
    expect(screen.getByText('시즌 결과')).toBeInTheDocument();
    expect(screen.getByText('이전 기록')).toBeInTheDocument();
    const chatButton = screen.getByRole('button', { name: /과거 대화/ });
    expect(chatButton).toBeInTheDocument();
    expect(chatButton).not.toBeDisabled();
  });

  it('post-match Home can keep chat visible when the capability allows matched conversation', () => {
    render(
      <HomeQuickMenuSection {...handlers} seasonState="SEASON_POST_MATCH" canStartChat={true} />,
    );

    expect(screen.queryByText('룸메 찾기')).not.toBeInTheDocument();
    expect(screen.getByText('채팅')).toBeInTheDocument();
    expect(screen.getByText('대화 보기')).toBeInTheDocument();
  });
});

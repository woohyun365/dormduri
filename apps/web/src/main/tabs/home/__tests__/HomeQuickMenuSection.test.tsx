import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeQuickMenuSection } from '../sections/quick-actions/HomeQuickMenuSection';

const defaultProps = {
  seasonState: 'SEASON_MATCHING' as const,
  onNavigateList: vi.fn(),
  onNavigateMatching: vi.fn(),
  onNavigateMatchingHistory: vi.fn(),
  onNavigateChat: vi.fn(),
  onNavigateProfile: vi.fn(),
};

describe('HomeQuickMenuSection', () => {
  it('시즌 매칭 시 4개 메뉴를 렌더링한다', () => {
    render(<HomeQuickMenuSection {...defaultProps} />);
    expect(screen.getByText('룸메 찾기')).toBeDefined();
    expect(screen.getByText('매칭 현황')).toBeDefined();
    expect(screen.getByText('채팅')).toBeDefined();
    expect(screen.getByText('내 프로필')).toBeDefined();
  });

  it('시즌 매칭 시 description이 올바르다', () => {
    render(<HomeQuickMenuSection {...defaultProps} />);
    expect(screen.getByText('룸메 탐색')).toBeDefined();
    expect(screen.getByText('현황 확인')).toBeDefined();
  });

  it('비시즌 시 가능한 읽기 전용 행동만 표시한다', () => {
    render(<HomeQuickMenuSection {...defaultProps} seasonState="OFF_SEASON" />);
    expect(screen.getByText('이전 기록')).toBeDefined();
    expect(screen.getByText('내 정보')).toBeDefined();
    expect(screen.queryByText('탐색 닫힘')).toBeNull();
    expect(screen.queryByText('과거 대화')).toBeNull();
  });

  it('비시즌 history가 없어도 이전 기록 CTA는 탭 이동을 허용한다', async () => {
    const user = userEvent.setup();
    const onNavigateMatchingHistory = vi.fn();
    render(
      <HomeQuickMenuSection
        {...defaultProps}
        seasonState="OFF_SEASON"
        canViewMatchHistory={false}
        onNavigateMatchingHistory={onNavigateMatchingHistory}
      />,
    );

    const historyButton = screen.getByRole('button', { name: /이전 기록/ });
    expect(historyButton).not.toBeDisabled();
    expect(screen.queryByText('이전 시즌 기록을 아직 불러올 수 없어요.')).not.toBeInTheDocument();

    await user.click(historyButton);
    expect(onNavigateMatchingHistory).toHaveBeenCalledOnce();
  });

  it('시즌 오픈 시 룸메 찾기와 채팅을 탭 이동 CTA로 표시한다', async () => {
    const user = userEvent.setup();
    const onNavigateList = vi.fn();
    const onNavigateChat = vi.fn();
    render(
      <HomeQuickMenuSection
        {...defaultProps}
        seasonState="SEASON_OPEN"
        canEnterRoommateSearch={false}
        canStartChat={false}
        onNavigateList={onNavigateList}
        onNavigateChat={onNavigateChat}
      />,
    );

    const searchButton = screen.getByRole('button', { name: /룸메 찾기/ });
    const chatButton = screen.getByRole('button', { name: /채팅/ });
    expect(searchButton).not.toBeDisabled();
    expect(chatButton).not.toBeDisabled();
    expect(screen.getByText('후보 목록 확인')).toBeInTheDocument();
    expect(screen.getByText('대화 목록 확인')).toBeInTheDocument();
    expect(screen.getByText('기숙사·조건 설정')).toBeInTheDocument();

    await user.click(searchButton);
    await user.click(chatButton);
    expect(onNavigateList).toHaveBeenCalledOnce();
    expect(onNavigateChat).toHaveBeenCalledOnce();
  });

  it('채팅 버튼 클릭 시 핸들러를 호출한다', async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    render(<HomeQuickMenuSection {...defaultProps} onNavigateChat={onNavigateChat} />);
    const buttons = screen.getAllByRole('button');
    const chatButton = buttons.find((b) => b.textContent?.includes('채팅'));
    await user.click(chatButton!);
    expect(onNavigateChat).toHaveBeenCalledOnce();
  });

  it('룸메 찾기 클릭 시 핸들러를 호출한다', async () => {
    const user = userEvent.setup();
    const onNavigateList = vi.fn();
    render(<HomeQuickMenuSection {...defaultProps} onNavigateList={onNavigateList} />);
    const buttons = screen.getAllByRole('button');
    const listButton = buttons.find((b) => b.textContent?.includes('룸메 찾기'));
    await user.click(listButton!);
    expect(onNavigateList).toHaveBeenCalledOnce();
  });

  it('비시즌에는 닫힌 탐색 disabled action을 렌더링하지 않는다', () => {
    const onNavigateList = vi.fn();
    render(
      <HomeQuickMenuSection
        {...defaultProps}
        seasonState="OFF_SEASON"
        onNavigateList={onNavigateList}
      />,
    );

    expect(screen.queryByRole('button', { name: /탐색 닫힘/ })).not.toBeInTheDocument();
    expect(onNavigateList).not.toHaveBeenCalled();
  });

  it('매칭 시즌도 HomeTab에서 blocked하지 않고 대상 탭으로 위임한다', async () => {
    const user = userEvent.setup();
    const onNavigateList = vi.fn();
    const onNavigateChat = vi.fn();
    render(
      <HomeQuickMenuSection
        {...defaultProps}
        seasonState="SEASON_MATCHING"
        canEnterRoommateSearch={false}
        canStartChat={false}
        onNavigateList={onNavigateList}
        onNavigateChat={onNavigateChat}
      />,
    );

    const searchButton = screen.getByRole('button', { name: /룸메 찾기/ });
    const chatButton = screen.getByRole('button', { name: /채팅/ });
    expect(searchButton).not.toBeDisabled();
    expect(chatButton).not.toBeDisabled();
    expect(screen.queryByText(/조건을 만족해야/)).not.toBeInTheDocument();

    await user.click(searchButton);
    await user.click(chatButton);
    expect(onNavigateList).toHaveBeenCalledOnce();
    expect(onNavigateChat).toHaveBeenCalledOnce();
  });

  it('매칭 현황 클릭 시 핸들러를 호출한다', async () => {
    const user = userEvent.setup();
    const onNavigateMatching = vi.fn();
    render(<HomeQuickMenuSection {...defaultProps} onNavigateMatching={onNavigateMatching} />);
    const buttons = screen.getAllByRole('button');
    const matchingButton = buttons.find((b) => b.textContent?.includes('매칭 현황'));
    await user.click(matchingButton!);
    expect(onNavigateMatching).toHaveBeenCalledOnce();
  });
});

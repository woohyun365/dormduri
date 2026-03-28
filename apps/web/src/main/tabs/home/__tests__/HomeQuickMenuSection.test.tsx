import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeQuickMenuSection } from '../HomeQuickMenuSection';

const defaultProps = {
  seasonState: 'SEASON_MATCHING' as const,
  onNavigateList: vi.fn(),
  onNavigateMatching: vi.fn(),
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

  it('비시즌 시 이전 기록과 과거 대화를 표시한다', () => {
    render(<HomeQuickMenuSection {...defaultProps} seasonState="OFF_SEASON" />);
    expect(screen.getByText('이전 기록')).toBeDefined();
    expect(screen.getByText('과거 대화')).toBeDefined();
    expect(screen.getByText('미리보기')).toBeDefined();
  });

  it('시즌 오픈 시 미리보기와 시즌 중 이용을 표시한다', () => {
    render(<HomeQuickMenuSection {...defaultProps} seasonState="SEASON_OPEN" />);
    expect(screen.getByText('미리보기')).toBeDefined();
    expect(screen.getByText('시즌 중 이용')).toBeDefined();
  });

  it('채팅 버튼은 disabled 상태로 핸들러를 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    render(<HomeQuickMenuSection {...defaultProps} onNavigateChat={onNavigateChat} />);
    const buttons = screen.getAllByRole('button');
    const chatButton = buttons.find((b) => b.textContent?.includes('채팅'));
    await user.click(chatButton!);
    expect(onNavigateChat).not.toHaveBeenCalled();
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

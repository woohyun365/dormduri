import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeQuickMenuSection } from '../HomeQuickMenuSection';

const defaultProps = {
  onNavigateList: vi.fn(),
  onNavigateMatching: vi.fn(),
  onNavigateChat: vi.fn(),
  onNavigateProfile: vi.fn(),
  receivedPendingCount: 0,
};

describe('HomeQuickMenuSection', () => {
  it('4개 메뉴 버튼을 렌더링한다', () => {
    render(<HomeQuickMenuSection {...defaultProps} />);
    expect(screen.getByText('룸메 찾기')).toBeDefined();
    expect(screen.getByText('매칭 현황')).toBeDefined();
    expect(screen.getByText('채팅')).toBeDefined();
    expect(screen.getByText('내 프로필')).toBeDefined();
  });

  it('매칭 현황에 badge를 표시한다', () => {
    render(<HomeQuickMenuSection {...defaultProps} receivedPendingCount={3} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('badge가 0이면 표시하지 않는다', () => {
    render(<HomeQuickMenuSection {...defaultProps} receivedPendingCount={0} />);
    const buttons = screen.getAllByRole('button');
    // 매칭 현황 버튼 내에 badge span이 없어야 함
    const matchingButton = buttons.find((b) => b.textContent?.includes('매칭 현황'));
    expect(matchingButton?.querySelector('.bg-red-500')).toBeNull();
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

  it('채팅 버튼은 disabled 상태로 핸들러를 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const onNavigateChat = vi.fn();
    render(<HomeQuickMenuSection {...defaultProps} onNavigateChat={onNavigateChat} />);
    const buttons = screen.getAllByRole('button');
    const chatButton = buttons.find((b) => b.textContent?.includes('채팅'));
    await user.click(chatButton!);
    expect(onNavigateChat).not.toHaveBeenCalled();
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

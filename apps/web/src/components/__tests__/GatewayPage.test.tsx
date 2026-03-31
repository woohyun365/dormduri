import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GatewayPage from '../GatewayPage';
import { useCurrentUser } from '@/hooks/useCurrentUser';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/landing/Landing', () => ({
  default: () => <div data-testid="landing">Landing</div>,
}));

vi.mock('@/main/Main', () => ({
  default: ({ initialUser }: { initialUser: { id: string; nickname: string } }) => (
    <div data-testid="main" data-user-id={initialUser.id} data-nickname={initialUser.nickname}>
      Main
    </div>
  ),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);

describe('GatewayPage', () => {
  it('로딩 중이면 스켈레톤을 표시한다', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, setUser: vi.fn(), isLoading: true });

    render(<GatewayPage />);

    expect(screen.getByText('서비스를 준비하고 있어요')).toBeInTheDocument();
  });

  it('비로그인 시 Landing을 렌더링한다', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, setUser: vi.fn(), isLoading: false });

    render(<GatewayPage />);

    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('로그인 시 Main을 렌더링한다', () => {
    mockUseCurrentUser.mockReturnValue({
      user: { id: '1', nickname: 'tester' } as ReturnType<typeof useCurrentUser>['user'],
      setUser: vi.fn(),
      isLoading: false,
    });

    render(<GatewayPage />);

    const main = screen.getByTestId('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('data-user-id', '1');
    expect(main).toHaveAttribute('data-nickname', 'tester');
  });
});

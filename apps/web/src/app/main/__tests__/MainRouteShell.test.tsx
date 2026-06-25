import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MainRouteShell from '../MainRouteShell.client';
import { useCurrentUser } from '@/auth/hooks';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/components/AppShellSkeleton', () => ({
  AppShellSkeleton: () => <div data-testid="app-shell-skeleton">loading app shell</div>,
}));

vi.mock('@/main/Main', () => ({
  default: ({ initialUser }: { initialUser: { id: string; nickname: string } }) => (
    <div data-testid="main" data-user-id={initialUser.id} data-nickname={initialUser.nickname}>
      Main
    </div>
  ),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);

describe('MainRouteShell', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('session 확인 중에는 app shell skeleton을 표시한다', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, setUser: vi.fn(), isLoading: true });

    render(<MainRouteShell />);

    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('인증 사용자가 있으면 Main을 렌더링한다', () => {
    mockUseCurrentUser.mockReturnValue({
      user: { id: 'user-1', nickname: '테스터' } as ReturnType<typeof useCurrentUser>['user'],
      setUser: vi.fn(),
      isLoading: false,
    });

    render(<MainRouteShell />);

    const main = screen.getByTestId('main');
    expect(main).toHaveAttribute('data-user-id', 'user-1');
    expect(main).toHaveAttribute('data-nickname', '테스터');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('proxy 보호를 통과했지만 session이 없으면 /login으로 fail-closed 한다', async () => {
    mockUseCurrentUser.mockReturnValue({ user: null, setUser: vi.fn(), isLoading: false });

    render(<MainRouteShell />);

    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});

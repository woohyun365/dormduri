import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MainRouteShell from '../MainRouteShell.client';
import { useAuthSession } from '@/auth/hooks';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/auth/hooks', () => ({
  useAuthSession: vi.fn(),
}));

vi.mock('@/app/main/components/AppShellSkeleton', () => ({
  AppShellSkeleton: () => <div data-testid="app-shell-skeleton">loading app shell</div>,
}));

vi.mock('@/main/runtime/MainRuntime', () => ({
  MainRuntime: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main">{children}</div>
  ),
}));

const mockUseAuthSession = vi.mocked(useAuthSession);

const sessionUser = {
  id: 'user-1',
  email: 'tester@kangwon.ac.kr',
  nickname: '세션유저',
  gender: 'M',
  campus: 'CHUNCHEON',
} satisfies NonNullable<ReturnType<typeof useAuthSession>['user']>;

describe('MainRouteShell', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockUseAuthSession.mockReset();
  });

  it('session 확인 중에는 app shell skeleton을 표시한다', () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      isLoading: true,
      status: 'loading',
      code: undefined,
      retry: vi.fn(),
    });

    render(
      <MainRouteShell>
        <span>route child</span>
      </MainRouteShell>,
    );

    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('proxy 보호를 통과했지만 session이 없으면 /login으로 fail-closed 한다', async () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      isLoading: false,
      status: 'unauthenticated',
      code: undefined,
      retry: vi.fn(),
    });

    render(
      <MainRouteShell>
        <span>route child</span>
      </MainRouteShell>,
    );

    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('인증 session이 있으면 profile bootstrap 없이 Main을 렌더링한다', () => {
    mockUseAuthSession.mockReturnValue({
      user: sessionUser,
      isLoading: false,
      status: 'authenticated',
      code: undefined,
      retry: vi.fn(),
    });

    render(
      <MainRouteShell>
        <span>route child</span>
      </MainRouteShell>,
    );

    expect(screen.getByTestId('main')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('session dependency 장애는 로그인으로 이동하지 않고 복구 화면을 표시한다', () => {
    const retry = vi.fn();
    mockUseAuthSession.mockReturnValue({
      user: null,
      isLoading: false,
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
      retry,
    });

    render(
      <MainRouteShell>
        <span>route child</span>
      </MainRouteShell>,
    );

    expect(screen.getByRole('heading', { name: '로그인 상태를 확인하지 못했어요' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '로그인 상태 다시 확인' })).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('viewer change or unavailable session discards the private child tree before recovery', () => {
    const authenticated = {
      user: sessionUser,
      isLoading: false,
      status: 'authenticated' as const,
      code: undefined,
      retry: vi.fn(),
    };
    mockUseAuthSession.mockReturnValue(authenticated);
    function PrivateDraft() {
      const [draft, setDraft] = React.useState('');
      return (
        <input
          aria-label="private draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      );
    }
    const tree = (
      <MainRouteShell>
        <PrivateDraft />
      </MainRouteShell>
    );
    const view = render(tree);
    fireEvent.change(screen.getByLabelText('private draft'), {
      target: { value: 'previous account' },
    });
    mockUseAuthSession.mockReturnValue({
      ...authenticated,
      user: { ...sessionUser, id: 'user-2' },
    });
    view.rerender(
      <MainRouteShell>
        <PrivateDraft />
      </MainRouteShell>,
    );
    expect(screen.getByLabelText('private draft')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('private draft'), { target: { value: 'private' } });
    mockUseAuthSession.mockReturnValue({ ...authenticated, user: null, status: 'unavailable' });
    view.rerender(
      <MainRouteShell>
        <PrivateDraft />
      </MainRouteShell>,
    );
    expect(screen.queryByLabelText('private draft')).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    mockUseAuthSession.mockReturnValue(authenticated);
    view.rerender(
      <MainRouteShell>
        <PrivateDraft />
      </MainRouteShell>,
    );
    expect(screen.getByLabelText('private draft')).toHaveValue('');
  });
});

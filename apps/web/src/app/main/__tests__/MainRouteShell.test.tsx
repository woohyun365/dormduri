import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MainRouteShell from '../MainRouteShell.client';
import { useAuthSession } from '@/auth/hooks';
import { useMainBootstrap } from '@/main/hooks/useMainBootstrap';
import type { UserProfile } from '@/types/profile';

const mockReplace = vi.fn();
const mockRetry = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/auth/hooks', () => ({
  useAuthSession: vi.fn(),
}));

vi.mock('@/main/hooks/useMainBootstrap', () => ({
  useMainBootstrap: vi.fn(),
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

const mockUseAuthSession = vi.mocked(useAuthSession);
const mockUseMainBootstrap = vi.mocked(useMainBootstrap);

const sessionUser = {
  id: 'user-1',
  email: 'tester@kangwon.ac.kr',
  nickname: '세션유저',
  gender: 'M',
  campus: 'CHUNCHEON',
} satisfies NonNullable<ReturnType<typeof useAuthSession>['user']>;

const profileUser = {
  id: 'profile-user-1',
  nickname: '프로필유저',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: {
    bedtime: null,
    wakeTime: null,
    sleepHabit: null,
    sleepEnvironment: null,
    screenUsage: null,
    noiseSensitivity: null,
    smokingBehavior: null,
    indoorEating: null,
    phoneBehavior: null,
    earphoneUsage: null,
    cleanLevel: null,
    drinkingFrequency: null,
    relationshipStyle: null,
    temperatureSensitivity: null,
    smokingTolerance: null,
    phoneTolerance: null,
    earphoneExpectation: null,
    sleepEnvPreference: null,
    screenTolerance: null,
    indoorEatingTolerance: null,
    cleanExpectation: null,
    drinkingTolerance: null,
  },
  intro: '프로필 API에서 온 소개',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
} satisfies UserProfile;

function mockBootstrap(result: Partial<ReturnType<typeof useMainBootstrap>>) {
  mockUseMainBootstrap.mockReturnValue({
    profile: null,
    status: 'idle',
    isLoading: false,
    retry: mockRetry,
    ...result,
  });
}

describe('MainRouteShell', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockRetry.mockClear();
    mockUseAuthSession.mockReset();
    mockUseMainBootstrap.mockReset();
    mockBootstrap({});
  });

  it('session 확인 중에는 app shell skeleton을 표시하고 Main bootstrap은 비활성화한다', () => {
    mockUseAuthSession.mockReturnValue({ user: null, isLoading: true });

    render(<MainRouteShell />);

    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
    expect(mockUseMainBootstrap).toHaveBeenCalledWith({ enabled: false, sessionUserId: null });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('proxy 보호를 통과했지만 session이 없으면 /login으로 fail-closed 한다', async () => {
    mockUseAuthSession.mockReturnValue({ user: null, isLoading: false });

    render(<MainRouteShell />);

    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
    expect(mockUseMainBootstrap).toHaveBeenCalledWith({ enabled: false, sessionUserId: null });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('인증 session 확인 후 profile bootstrap 중에는 skeleton을 유지한다', () => {
    mockUseAuthSession.mockReturnValue({ user: sessionUser, isLoading: false });
    mockBootstrap({ status: 'idle', isLoading: true });

    render(<MainRouteShell />);

    expect(mockUseMainBootstrap).toHaveBeenCalledWith({ enabled: true, sessionUserId: 'user-1' });
    expect(screen.getByTestId('app-shell-skeleton')).toBeInTheDocument();
  });

  it('인증 session과 profile API 결과가 있으면 profile 결과로 Main을 렌더링한다', () => {
    mockUseAuthSession.mockReturnValue({ user: sessionUser, isLoading: false });
    mockBootstrap({ status: 'ready', profile: profileUser });

    render(<MainRouteShell />);

    const main = screen.getByTestId('main');
    expect(main).toHaveAttribute('data-user-id', 'profile-user-1');
    expect(main).toHaveAttribute('data-nickname', '프로필유저');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('profile API가 null을 반환하면 auth 성공과 profile 불완성을 구분해 fallback을 표시한다', () => {
    mockUseAuthSession.mockReturnValue({ user: sessionUser, isLoading: false });
    mockBootstrap({ status: 'profile-incomplete', profile: null });

    render(<MainRouteShell />);

    expect(screen.getByRole('alert')).toHaveTextContent('프로필 정보를 확인하지 못했어요');
    expect(screen.getByRole('alert')).toHaveTextContent('로그인은 확인됐지만');
    expect(screen.queryByTestId('main')).not.toBeInTheDocument();
  });

  it('profile bootstrap 실패 fallback에서 다시 불러오기를 요청할 수 있다', async () => {
    const user = userEvent.setup();
    mockUseAuthSession.mockReturnValue({ user: sessionUser, isLoading: false });
    mockBootstrap({ status: 'error', profile: null });

    render(<MainRouteShell />);

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});

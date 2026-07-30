import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPageClient from '../LoginPageClient';
import { authApi } from '@/auth/api';
import { useRedirectIfAuthenticated } from '@/auth/hooks';

const mockReplace = vi.fn();
const mockPush = vi.fn();
let nextTarget: string | null = null;
let resetStatus: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'next') return nextTarget;
      if (key === 'reset') return resetStatus;
      return null;
    },
  }),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();

  return {
    ...actual,
    Mail: () => <span data-testid="icon-mail" />,
    Lock: () => <span data-testid="icon-lock" />,
    AlertCircle: () => <span data-testid="icon-alert" />,
    Timer: () => <span data-testid="icon-timer" />,
    Eye: () => <span data-testid="icon-eye" />,
    EyeOff: () => <span data-testid="icon-eye-off" />,
    Check: () => <span data-testid="icon-check-mark" />,
    CheckCircle: () => <span data-testid="icon-check-circle" />,
    WifiOff: () => <span data-testid="icon-wifi-off" />,
  };
});

vi.mock('@/auth/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/hooks')>();

  return {
    ...actual,
    useRedirectIfAuthenticated: vi.fn(() => ({
      isReadyToRender: true,
      sessionStatus: 'unauthenticated',
      retrySession: vi.fn(),
    })),
  };
});

vi.mock('@/auth/api', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

const mockRedirectHook = vi.mocked(useRedirectIfAuthenticated);
const mockLogin = vi.mocked(authApi.login);

describe('LoginPageClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nextTarget = null;
    resetStatus = null;
    mockLogin.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  it('session loading이면 card와 preview 없이 확인 상태를 렌더링한다', () => {
    mockRedirectHook.mockReturnValueOnce({
      isReadyToRender: false,
      sessionStatus: 'loading',
      retrySession: vi.fn(),
    });

    render(<LoginPageClient />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('잠시만 기다려 주세요.');
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    expect(screen.queryByText('서비스 이용 흐름')).not.toBeInTheDocument();
  });

  it('authenticated session이면 card와 preview 없이 main 이동 상태를 렌더링한다', () => {
    mockRedirectHook.mockReturnValueOnce({
      isReadyToRender: false,
      sessionStatus: 'authenticated',
      retrySession: vi.fn(),
    });

    render(<LoginPageClient />);

    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'redirecting');
    expect(screen.getByRole('status')).toHaveTextContent('로그인되어 있어요');
    expect(screen.getByRole('status')).toHaveTextContent('메인으로 이동하고 있어요.');
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    expect(screen.queryByText('서비스 이용 흐름')).not.toBeInTheDocument();
  });

  it('로그인 폼을 렌더링한다', () => {
    render(<LoginPageClient />);

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('session unavailable이어도 로그인 폼과 다시 확인 안내를 함께 표시한다', () => {
    const retrySession = vi.fn();
    mockRedirectHook.mockReturnValueOnce({
      isReadyToRender: true,
      sessionStatus: 'unavailable',
      retrySession,
    });

    render(<LoginPageClient />);

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('로그인 상태 확인이 잠시 늦어져요');
    expect(status).toHaveTextContent('로그인은 계속할 수 있어요.');
    expect(status.closest('form')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    expect(retrySession).toHaveBeenCalledTimes(1);
  });

  it('reset=success query가 있으면 비밀번호 변경 후 재로그인 안내를 표시한다', () => {
    resetStatus = 'success';

    render(<LoginPageClient />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('비밀번호가 변경되었어요');
    expect(status).toHaveTextContent('새 비밀번호로 다시 로그인해주세요.');
    expect(status.closest('form')).toBeInTheDocument();
  });

  it('허용되지 않은 reset query는 로그인 route status로 표시하지 않는다', () => {
    resetStatus = 'unknown';

    render(<LoginPageClient />);

    expect(screen.queryByText('비밀번호가 변경되었어요')).not.toBeInTheDocument();
  });

  it('빈 필드 제출 시 유효성 검사 에러를 표시한다', async () => {
    render(<LoginPageClient />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });

    expect(screen.getByText('이메일을 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('로그인 성공 시 /main으로 리다이렉트한다', async () => {
    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test@kangwon.ac.kr' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });

    expect(mockLogin).toHaveBeenCalledWith('test@kangwon.ac.kr', 'password123', false);
    expect(mockReplace).toHaveBeenCalledWith('/main');
    expect(screen.getByRole('button', { name: '홈으로 이동 중...' })).toBeDisabled();
  });

  it('로그인 실패 시 에러 메시지를 표시한다', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
    });

    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test@kangwon.ac.kr' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'wrongpass' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });

    expect(screen.getByText('이메일 또는 비밀번호를 확인해 주세요.')).toBeInTheDocument();
  });

  it('계정 잠금 시 잠금 안내와 타이머를 표시한다', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      locked: true,
      remainingSeconds: 300,
      error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
    });

    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test@kangwon.ac.kr' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'wrongpass' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    });

    expect(
      screen.getByText('로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/남은 시간/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계정 잠금 중' })).toBeDisabled();
  });

  it('rememberMe 체크 시 안내 문구를 표시한다', () => {
    render(<LoginPageClient />);

    fireEvent.click(screen.getByLabelText('로그인 유지'));

    expect(screen.getAllByText('개인 기기에서만 권장해요 (7일간 유지)').length).toBeGreaterThan(0);
  });

  it('비밀번호 찾기와 회원가입 CTA를 route callback으로 분리한다', () => {
    render(<LoginPageClient />);

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: '이메일로 회원가입' }));

    expect(mockPush).toHaveBeenCalledWith('/password-reset');
    expect(mockPush).toHaveBeenCalledWith('/signup');
  });
});

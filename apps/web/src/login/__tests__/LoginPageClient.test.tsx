import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPageClient from '../LoginPageClient';
import { authApi } from '@/api/auth';
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated';

const mockReplace = vi.fn();
const mockPush = vi.fn();
let nextTarget: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'next' ? nextTarget : null),
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

vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="icon-mail" />,
  Lock: () => <span data-testid="icon-lock" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Timer: () => <span data-testid="icon-timer" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eye-off" />,
  Check: () => <span data-testid="icon-check-mark" />,
}));

vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({
  useRedirectIfAuthenticated: vi.fn(() => ({ isReadyToRender: true })),
}));

vi.mock('@/api/auth', () => ({
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
    mockLogin.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  it('isReadyToRender가 false이면 접근 가능한 session 확인 상태를 렌더링하고 폼은 숨긴다', () => {
    mockRedirectHook.mockReturnValueOnce({ isReadyToRender: false });

    render(<LoginPageClient />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있어요');
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
  });

  it('로그인 폼을 렌더링한다', () => {
    render(<LoginPageClient />);

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
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

    expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
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

    fireEvent.click(screen.getByLabelText('로그인 유지(최대 7일)'));

    expect(
      screen.getAllByText(/최대 7일 동안 다시 로그인하지 않아도 됩니다/).length,
    ).toBeGreaterThan(0);
  });

  it('비밀번호 찾기와 회원가입 CTA를 route callback으로 분리한다', () => {
    render(<LoginPageClient />);

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: '이메일로 회원가입' }));

    expect(mockPush).toHaveBeenCalledWith('/password-reset');
    expect(mockPush).toHaveBeenCalledWith('/signup');
  });
});

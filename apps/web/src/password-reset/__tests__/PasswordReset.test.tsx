import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/api/auth';
import { RESET_PASSWORD_VERIFICATION_CODE_TTL } from '@/constants/auth';
import PasswordResetPageClient from '../PasswordResetPageClient';

// --- Mocks ---

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
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
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eye-off" />,
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    sendResetCode: vi.fn(),
    verifyResetCode: vi.fn(),
    resetPassword: vi.fn(),
    getSession: vi.fn(),
  },
}));

const mockSendCode = vi.mocked(authApi.sendResetCode);
const mockVerifyCode = vi.mocked(authApi.verifyResetCode);
const mockResetPassword = vi.mocked(authApi.resetPassword);
const mockGetSession = vi.mocked(authApi.getSession);

// --- Helpers ---

async function fillAndSubmitEmail() {
  const emailInput = screen.getByLabelText(/학교 이메일/);
  fireEvent.change(emailInput, { target: { value: 'test@kangwon.ac.kr' } });

  const sendButton = screen.getByRole('button', { name: '인증 코드 전송' });
  await act(async () => {
    fireEvent.click(sendButton);
  });
}

function advanceToVerification() {
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

// --- Tests ---

describe('PasswordResetPageClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSendCode.mockResolvedValue({ success: true });
    mockVerifyCode.mockResolvedValue({ success: true });
    mockResetPassword.mockResolvedValue({ success: true });
    mockGetSession.mockResolvedValue({ authenticated: false });
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('T-1: 재전송 쿨다운 뒤로가기 우회 불가', () => {
    it('verification에서 뒤로가기 후 쿨다운 중 재전송이 차단된다', async () => {
      render(<PasswordResetPageClient />);

      // 이메일 입력 → 전송
      await fillAndSubmitEmail();
      expect(mockSendCode).toHaveBeenCalledTimes(1);

      // verification 단계로 전환
      advanceToVerification();
      expect(screen.getByText('인증 코드 확인')).toBeInTheDocument();

      // 뒤로가기 → email 단계 복귀
      fireEvent.click(screen.getByLabelText('뒤로가기'));
      expect(screen.getByText('비밀번호 찾기')).toBeInTheDocument();

      // 재전송 시도 → isActive 가드로 차단
      mockSendCode.mockClear();
      await fillAndSubmitEmail();
      expect(mockSendCode).not.toHaveBeenCalled();
    });
  });

  describe('T-2: 카운트다운 만료 메시지 노출', () => {
    it('카운트다운이 0이 되면 만료 안내 메시지가 표시된다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      // 카운트다운 진행 중 — 타이머 표시
      expect(screen.getByRole('timer')).toBeInTheDocument();

      // 카운트다운 만료
      act(() => {
        vi.advanceTimersByTime(RESET_PASSWORD_VERIFICATION_CODE_TTL * 1000);
      });

      // 만료 메시지 표시 + 타이머 소멸
      expect(
        screen.getByText('인증 시간이 만료됐어요. 재전송으로 새 코드를 받아주세요.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });
  });

  describe('T-3: 재전송 중 버튼 비활성화 + 연타 차단', () => {
    it('쿨다운 중 재전송 버튼이 비활성화된다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      expect(screen.getByRole('button', { name: /재전송/ })).toBeDisabled();
    });

    it('쿨다운 만료 후 재전송 시 "전송 중..." 표시 후 카운트다운 재시작', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      // 카운트다운 만료
      act(() => {
        vi.advanceTimersByTime(RESET_PASSWORD_VERIFICATION_CODE_TTL * 1000);
      });

      // 지연 응답으로 교체하여 isSending 상태 확인
      let resolveSend!: (v: { success: boolean }) => void;
      mockSendCode.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );

      // 재전송 버튼 활성화 확인 → 클릭
      const resendButton = screen.getByRole('button', { name: '재전송' });
      expect(resendButton).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(resendButton);
      });

      // "전송 중..." + 비활성화
      expect(screen.getByRole('button', { name: '전송 중...' })).toBeDisabled();

      // API 응답 완료
      await act(async () => {
        resolveSend({ success: true });
      });

      // 카운트다운 재시작 → "재전송 (M:SS)" + 비활성화
      expect(screen.getByRole('button', { name: /재전송 \(/ })).toBeDisabled();
    });
  });

  describe('T-4: unmount 후 setState 경고 미발생', () => {
    it('카운트다운 진행 중 unmount 시 에러가 발생하지 않는다', async () => {
      const consoleSpy = vi.spyOn(console, 'error');

      const { unmount } = render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      // 카운트다운 진행 중 unmount
      unmount();

      // 남은 타이머/인터벌 실행 — cleanup에 의해 안전하게 처리되어야 함
      act(() => {
        vi.advanceTimersByTime(RESET_PASSWORD_VERIFICATION_CODE_TTL * 1000);
      });

      // setState 관련 에러 없음
      const stateErrors = consoleSpy.mock.calls.filter(
        (args) => typeof args[0] === 'string' && args[0].includes('unmounted'),
      );
      expect(stateErrors).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('T-5: 전송 중 이메일 변경 시 이전 요청을 무시한다', () => {
    it('이메일 변경 후 이전 요청 완료가 verification 진입을 트리거하지 않는다', async () => {
      let resolveSend!: (v: { success: boolean; error?: string }) => void;
      mockSendCode.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );

      render(<PasswordResetPageClient />);

      const emailInput = screen.getByLabelText(/학교 이메일/);
      fireEvent.change(emailInput, { target: { value: 'first@kangwon.ac.kr' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '인증 코드 전송' }));
      });

      fireEvent.change(emailInput, { target: { value: 'test@kangwon.ac.kr' } });

      await act(async () => {
        resolveSend({ success: true });
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('비밀번호 찾기')).toBeInTheDocument();
      expect(screen.queryByText('인증 코드 확인')).not.toBeInTheDocument();
    });
  });

  describe('T-6: 검증/재설정 side effect hook 통합', () => {
    it('인증 코드 확인 후 새 비밀번호 제출이 hook을 통해 API를 호출하고 완료 화면으로 이동한다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      fireEvent.change(screen.getByLabelText(/인증 코드/), { target: { value: '123456' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });

      expect(mockVerifyCode).toHaveBeenCalledWith('test@kangwon.ac.kr', '123456');
      expect(screen.getByText('새 비밀번호 설정')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/새 비밀번호/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });
      fireEvent.change(screen.getByLabelText(/비밀번호 확인/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '비밀번호 재설정' }));
      });

      expect(mockResetPassword).toHaveBeenCalledWith('test@kangwon.ac.kr', 'Test1234');
      expect(screen.getByText('비밀번호 재설정 완료')).toBeInTheDocument();
      expect(screen.getByText(/기존 로그인 상태가 모두 종료되었어요/)).toBeInTheDocument();
    });

    it('완료 단계 CTA는 login reset success query로 replace 이동한다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      fireEvent.change(screen.getByLabelText(/인증 코드/), { target: { value: '123456' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });

      fireEvent.change(screen.getByLabelText(/새 비밀번호/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });
      fireEvent.change(screen.getByLabelText(/비밀번호 확인/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '비밀번호 재설정' }));
      });

      fireEvent.click(screen.getByRole('button', { name: '로그인하러 가기' }));

      expect(mockRouterReplace).toHaveBeenCalledWith('/login?reset=success');
      expect(mockRouterPush).not.toHaveBeenCalledWith('/login?reset=success');
    });
  });

  describe('T-7: Phase 2 visible status와 인증 상태 안내', () => {
    it('send-code 성공은 toast 없이 화면 내 neutral status로 확인할 수 있다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();

      expect(screen.getByRole('status')).toHaveTextContent(
        '입력한 이메일로 가입된 계정이 있는 경우 인증 코드가 발송돼요.',
      );
    });

    it('send-code 429는 화면 내 alert와 1초씩 줄어드는 retry-after countdown으로 표시된다', async () => {
      mockSendCode.mockResolvedValueOnce({ success: false, retryAfterSeconds: 3 });
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();

      expect(screen.getByRole('alert')).toHaveTextContent(
        '너무 잦은 요청이에요. 3초 후 다시 시도해주세요.',
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByRole('alert')).toHaveTextContent(
        '너무 잦은 요청이에요. 2초 후 다시 시도해주세요.',
      );
    });

    it('로그인된 세션이면 재설정 flow를 막지 않는 안내를 표시한다', async () => {
      mockGetSession.mockResolvedValueOnce({ authenticated: true });

      render(<PasswordResetPageClient />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText(/현재 로그인된 상태입니다/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '인증 코드 전송' })).toBeEnabled();
    });
  });

  describe('T-8: Phase 2 step hardening', () => {
    it('verification code input은 one-time-code autocomplete와 numeric inputMode를 사용한다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      const codeInput = screen.getByLabelText(/인증 코드/);
      expect(codeInput).toHaveAttribute('autocomplete', 'one-time-code');
      expect(codeInput).toHaveAttribute('inputmode', 'numeric');
    });

    it('step 전환 시 새 단계 heading으로 focus를 이동한다', async () => {
      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      expect(screen.getByRole('heading', { name: '인증 코드 확인' })).toHaveFocus();

      fireEvent.change(screen.getByLabelText(/인증 코드/), { target: { value: '123456' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });

      expect(screen.getByRole('heading', { name: '새 비밀번호 설정' })).toHaveFocus();
    });

    it('reset-password fieldErrors.newPassword는 새 비밀번호 필드 오류로 표시된다', async () => {
      mockResetPassword.mockResolvedValueOnce({
        success: false,
        code: 'AUTH_PASSWORD_UNCHANGED',
        error: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
        fieldErrors: {
          newPassword: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
        },
      });

      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      fireEvent.change(screen.getByLabelText(/인증 코드/), { target: { value: '123456' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });

      fireEvent.change(screen.getByLabelText(/새 비밀번호/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });
      fireEvent.change(screen.getByLabelText(/비밀번호 확인/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '비밀번호 재설정' }));
      });

      expect(
        screen.getByText('현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('비밀번호 재설정 완료')).not.toBeInTheDocument();
    });

    it('AUTH_RESET_RESTART_REQUIRED는 처음부터 다시 진행 CTA를 노출한다', async () => {
      mockResetPassword.mockResolvedValueOnce({
        success: false,
        code: 'AUTH_RESET_RESTART_REQUIRED',
        error: '비밀번호 재설정 요청을 다시 진행해주세요.',
      });

      render(<PasswordResetPageClient />);

      await fillAndSubmitEmail();
      advanceToVerification();

      fireEvent.change(screen.getByLabelText(/인증 코드/), { target: { value: '123456' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });

      fireEvent.change(screen.getByLabelText(/새 비밀번호/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });
      fireEvent.change(screen.getByLabelText(/비밀번호 확인/, { selector: 'input' }), {
        target: { value: 'Test1234' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '비밀번호 재설정' }));
      });

      expect(screen.getByRole('alert')).toHaveTextContent('재설정을 처음부터 다시 진행해주세요');
      fireEvent.click(screen.getByRole('button', { name: '이메일부터 다시 진행하기' }));
      expect(screen.getByText('비밀번호 찾기')).toBeInTheDocument();
    });
  });
});

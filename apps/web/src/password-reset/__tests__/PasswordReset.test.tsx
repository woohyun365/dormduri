import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PasswordResetPageClient from '../PasswordResetPageClient';
import { authApi } from '@/api/auth';
import { RESET_PASSWORD_VERIFICATION_CODE_TTL } from '@/constants/auth';

// --- Mocks ---

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  },
}));

const mockSendCode = vi.mocked(authApi.sendResetCode);
const mockVerifyCode = vi.mocked(authApi.verifyResetCode);
const mockResetPassword = vi.mocked(authApi.resetPassword);

// --- Helpers ---

async function fillAndSubmitEmail() {
  const emailInput = screen.getByLabelText('이메일');
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
        screen.getByText('인증 시간이 만료되었어요. 재전송 버튼을 눌러주세요.'),
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

      const emailInput = screen.getByLabelText('이메일');
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

      fireEvent.change(screen.getByLabelText('인증 코드'), { target: { value: '123456' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
      });

      expect(mockVerifyCode).toHaveBeenCalledWith('test@kangwon.ac.kr', '123456');
      expect(screen.getByText('새 비밀번호 설정')).toBeInTheDocument();

      const passwordInputs = screen.getAllByLabelText(/비밀번호/);
      fireEvent.change(passwordInputs[0]!, { target: { value: 'Test1234' } });
      fireEvent.change(passwordInputs[1]!, { target: { value: 'Test1234' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '비밀번호 재설정' }));
      });

      expect(mockResetPassword).toHaveBeenCalledWith('test@kangwon.ac.kr', 'Test1234');
      expect(screen.getByText('비밀번호 재설정 완료')).toBeInTheDocument();
    });
  });
});

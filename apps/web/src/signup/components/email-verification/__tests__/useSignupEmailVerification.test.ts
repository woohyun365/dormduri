import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSignupEmailVerification } from '../useSignupEmailVerification';
import { authApi } from '@/api/auth';

vi.mock('@/api/auth', () => ({
  authApi: {
    sendSignupCode: vi.fn(),
    verifyEmailCode: vi.fn(),
  },
}));

const mockSendCode = vi.mocked(authApi.sendSignupCode);
const mockVerifyCode = vi.mocked(authApi.verifyEmailCode);

describe('useSignupEmailVerification', () => {
  const onVerified = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onVerified.mockClear();
    mockSendCode.mockResolvedValue({ success: true });
    mockVerifyCode.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderEmailVerification(email = 'test@kangwon.ac.kr') {
    return renderHook(({ email: e }) => useSignupEmailVerification({ email: e, onVerified }), {
      initialProps: { email },
    });
  }

  async function sendCodeSuccessfully(result: {
    current: ReturnType<typeof useSignupEmailVerification>;
  }) {
    await act(async () => {
      await result.current.handleSendCode();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }

  describe('handleSendCode', () => {
    it('빈 이메일이면 에러를 표시하고 API를 호출하지 않는다', async () => {
      const { result } = renderEmailVerification('');

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe('이메일을 입력해주세요.');
      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('KNU 이메일이 아니면 에러를 표시한다', async () => {
      const { result } = renderEmailVerification('test@gmail.com');

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe('강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.');
      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('전송 성공 시 1초 후 코드 입력 상태로 전환된다', async () => {
      const { result } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.isSending).toBe(true);
      expect(result.current.isCodeSent).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.isCodeSent).toBe(true);
      expect(result.current.isCountdownActive).toBe(true);
    });

    it('API 실패 시 에러 메시지를 표시한다', async () => {
      mockSendCode.mockResolvedValue({ success: false, error: '서버 오류' });
      const { result } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe('서버 오류');
      expect(result.current.isSending).toBe(false);
    });

    it('네트워크 오류 시 에러 메시지를 표시한다', async () => {
      mockSendCode.mockRejectedValue(new Error('Network error'));
      const { result } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe(
        '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      );
      expect(result.current.isSending).toBe(false);
    });
  });

  describe('handleVerifyCode', () => {
    it('코드 미입력 시 에러를 표시한다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      await act(async () => {
        await result.current.handleVerifyCode();
      });

      expect(result.current.codeError).toBe('인증 코드를 입력해주세요.');
    });

    it('인증 성공 시 onVerified를 호출하고 카운트다운을 중지한다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      act(() => {
        result.current.handleCodeChange('123456');
      });

      await act(async () => {
        await result.current.handleVerifyCode();
      });

      expect(onVerified).toHaveBeenCalled();
      expect(result.current.codeError).toBe('');
      expect(result.current.isCountdownActive).toBe(false);
    });

    it('인증 실패 시 에러 메시지를 표시한다', async () => {
      mockVerifyCode.mockResolvedValue({
        success: false,
        error: '인증 코드가 올바르지 않습니다.',
      });
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      act(() => {
        result.current.handleCodeChange('000000');
      });

      await act(async () => {
        await result.current.handleVerifyCode();
      });

      expect(result.current.codeError).toBe('인증 코드가 올바르지 않습니다.');
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('handleEmailChange', () => {
    it('이메일 수정 시 코드 상태를 초기화한다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      expect(result.current.isCodeSent).toBe(true);
      expect(result.current.isCountdownActive).toBe(true);

      act(() => {
        result.current.handleEmailChange();
      });

      expect(result.current.isCodeSent).toBe(false);
      expect(result.current.isCountdownActive).toBe(false);
      expect(result.current.verificationCode).toBe('');
      expect(result.current.emailError).toBe('');
    });
  });

  describe('cleanup', () => {
    it('unmount 시 타이머가 정리된다', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const { result, unmount } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const stateErrors = consoleSpy.mock.calls.filter(
        (args) => typeof args[0] === 'string' && args[0].includes('unmounted'),
      );
      expect(stateErrors).toHaveLength(0);
      consoleSpy.mockRestore();
    });
  });
});

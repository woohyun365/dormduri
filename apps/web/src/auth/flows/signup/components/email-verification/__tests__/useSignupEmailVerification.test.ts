import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSignupEmailVerification } from '../useSignupEmailVerification';
import { authApi } from '@/auth/api';

vi.mock('@/auth/api', () => ({
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

    it('API 실패 시 action feedback을 표시한다', async () => {
      mockSendCode.mockResolvedValue({ success: false, error: '서버 오류' });
      const { result } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe('');
      expect(result.current.actionFeedback).toMatchObject({
        variant: 'error',
        title: '인증 코드를 보내지 못했어요',
        description: '서버 오류',
      });
      expect(result.current.isSending).toBe(false);
    });

    it('재전송 성공은 기존 코드 입력을 비우고 success feedback을 표시한다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);
      act(() => {
        result.current.handleCodeChange('123456');
      });

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.verificationCode).toBe('');
      expect(result.current.actionFeedback).toEqual({
        variant: 'success',
        title: '새 인증 코드를 보냈어요',
        description: '메일에서 새 코드를 확인해 주세요.',
      });
      expect(result.current.isCodeSent).toBe(true);
    });

    it('재전송 실패는 기존 코드 입력을 유지하고 error feedback을 표시한다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);
      act(() => {
        result.current.handleCodeChange('123456');
      });
      mockSendCode.mockResolvedValueOnce({ success: false, error: '메일 전송 실패' });

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.verificationCode).toBe('123456');
      expect(result.current.actionFeedback).toEqual({
        variant: 'error',
        title: '인증 코드를 보내지 못했어요',
        description: '메일 전송 실패',
      });
    });

    it('429 retryAfterSeconds가 있으면 action feedback과 버튼 countdown을 제공한다', async () => {
      mockSendCode.mockResolvedValue({
        success: false,
        retryAfterSeconds: 3,
      });
      const { result } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe('');
      expect(result.current.actionFeedback).toMatchObject({
        variant: 'warning',
        title: '잠시 후 다시 요청할 수 있어요',
      });
      expect(result.current.emailRetryAfterSeconds).toBe(3);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.emailRetryAfterSeconds).toBe(2);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.emailError).toBe('');
      expect(result.current.emailRetryAfterSeconds).toBe(0);
      expect(result.current.actionFeedback).toBeNull();
    });

    it('네트워크 오류 시 connectivity feedback을 표시한다', async () => {
      mockSendCode.mockRejectedValue(new Error('Network error'));
      const { result } = renderEmailVerification();

      await act(async () => {
        await result.current.handleSendCode();
      });

      expect(result.current.emailError).toBe('');
      expect(result.current.actionFeedback).toMatchObject({
        variant: 'connectivity',
        title: '인증 코드를 보내지 못했어요',
      });
      expect(result.current.isSending).toBe(false);
    });
  });

  describe('handleVerifyCode', () => {
    it('코드 재전송 중에는 기존 코드 확인 요청을 보내지 않는다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);
      act(() => {
        result.current.handleCodeChange('123456');
      });

      let resolveResend!: (value: { success: true }) => void;
      mockSendCode.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveResend = resolve;
          }),
      );

      await act(async () => {
        void result.current.handleSendCode();
        await Promise.resolve();
      });
      expect(result.current.isSending).toBe(true);

      await act(async () => {
        await result.current.handleVerifyCode();
      });
      expect(mockVerifyCode).not.toHaveBeenCalled();

      await act(async () => {
        resolveResend({ success: true });
      });
    });

    it('코드 미입력 시 에러를 표시한다', async () => {
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      await act(async () => {
        await result.current.handleVerifyCode();
      });

      expect(result.current.codeError).toBe('인증 코드를 입력해 주세요.');
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
        code: 'AUTH_VERIFICATION_CODE_INVALID',
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

    it('네트워크 실패 시 입력한 인증 코드를 유지한다', async () => {
      mockVerifyCode.mockRejectedValue(new Error('Network error'));
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      act(() => {
        result.current.handleCodeChange('123456');
      });

      await act(async () => {
        await result.current.handleVerifyCode();
      });

      expect(result.current.verificationCode).toBe('123456');
      expect(result.current.codeError).toBe('');
      expect(result.current.actionFeedback).toMatchObject({
        variant: 'connectivity',
        title: '인증 코드를 확인하지 못했어요',
        description: '네트워크를 확인한 뒤 다시 시도해 주세요.',
      });
    });

    it('429 retryAfterSeconds가 있으면 action feedback과 버튼 countdown을 제공한다', async () => {
      mockVerifyCode.mockResolvedValue({
        success: false,
        code: 'TOO_MANY_REQUESTS',
        retryAfterSeconds: 3,
      });
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      act(() => {
        result.current.handleCodeChange('000000');
      });

      await act(async () => {
        await result.current.handleVerifyCode();
      });

      expect(result.current.codeError).toBe('');
      expect(result.current.actionFeedback).toMatchObject({
        variant: 'warning',
        title: '잠시 후 다시 요청할 수 있어요',
      });
      expect(result.current.codeRetryAfterSeconds).toBe(3);
      expect(onVerified).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.codeRetryAfterSeconds).toBe(2);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.codeError).toBe('');
      expect(result.current.codeRetryAfterSeconds).toBe(0);
      expect(result.current.actionFeedback).toBeNull();
    });

    it('인증 코드 실패가 최대 횟수에 도달하면 새 코드 요청만 허용한다', async () => {
      mockVerifyCode.mockResolvedValue({
        success: false,
        code: 'AUTH_VERIFICATION_CODE_INVALID',
        error: '인증 코드가 올바르지 않습니다.',
      });
      const { result } = renderEmailVerification();
      await sendCodeSuccessfully(result);

      act(() => {
        result.current.handleCodeChange('000000');
      });

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await act(async () => {
          await result.current.handleVerifyCode();
        });
      }

      expect(result.current.codeError).toBe('');
      expect(result.current.isAttemptsExhausted).toBe(true);
      expect(result.current.isCountdownActive).toBe(false);
      expect(result.current.actionFeedback).toMatchObject({
        variant: 'warning',
        title: '인증 코드를 다시 받아 주세요',
      });
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

    it('전송 중 이메일 변경 시 이전 요청의 완료를 무시한다', async () => {
      let resolveSend!: (value: { success: boolean }) => void;
      mockSendCode.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );

      const { result, rerender } = renderEmailVerification('first@kangwon.ac.kr');

      await act(async () => {
        void result.current.handleSendCode();
      });

      rerender({ email: 'second@kangwon.ac.kr' });
      act(() => {
        result.current.handleEmailChange();
      });

      await act(async () => {
        resolveSend({ success: true });
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isCodeSent).toBe(false);
      expect(result.current.requestedEmail).toBe('');
      expect(result.current.isSending).toBe(false);
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

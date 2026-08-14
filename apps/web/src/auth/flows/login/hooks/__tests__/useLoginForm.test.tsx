import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginForm } from '../useLoginForm';

const VALID_EMAIL = 'student@kangwon.ac.kr';
const VALID_PASSWORD = 'password123';

describe('useLoginForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('빈 필드는 field error로 막고 login을 호출하지 않는다', async () => {
    const onLogin = vi.fn();
    const { result } = renderHook(() => useLoginForm({ onLogin }));

    await act(async () => {
      result.current.handleSubmit();
    });

    expect(result.current.fieldErrors).toEqual({
      email: '이메일을 입력해주세요.',
      password: '비밀번호를 입력해주세요.',
    });
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('성공 시 injected login을 호출하고 success target으로 이동한다', async () => {
    const onLogin = vi.fn(async () => ({ success: true }) as const);
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useLoginForm({ onLogin, onSuccess, redirectTarget: '/main' }),
    );

    act(() => {
      result.current.setEmail(VALID_EMAIL);
      result.current.setPassword(VALID_PASSWORD);
      result.current.setRememberMe(true);
    });
    await act(async () => {
      result.current.handleSubmit();
    });

    expect(onLogin).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD, true);
    expect(onSuccess).toHaveBeenCalledWith('/main');
    expect(result.current.redirectState).toEqual({ isRedirecting: true, target: '/main' });
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it('pending 중 duplicate submit을 막는다', async () => {
    let resolveLogin: (value: { success: true }) => void = () => undefined;
    const onLogin = vi.fn(
      () =>
        new Promise<{ success: true }>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const { result } = renderHook(() => useLoginForm({ onLogin }));

    act(() => {
      result.current.setEmail(VALID_EMAIL);
      result.current.setPassword(VALID_PASSWORD);
    });
    await act(async () => {
      result.current.handleSubmit();
      await Promise.resolve();
    });
    expect(result.current.isSubmitting).toBe(true);
    act(() => {
      result.current.handleSubmit();
    });

    expect(onLogin).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLogin({ success: true });
    });

    expect(result.current.redirectState.isRedirecting).toBe(true);
    expect(result.current.isSubmitDisabled).toBe(true);
  });

  it('locked response는 countdown과 disabled state를 시작한다', async () => {
    const onLogin = vi.fn(async () => ({
      success: false,
      locked: true,
      remainingSeconds: 300,
      error: '반복된 로그인 실패로 계정이 잠겼어요.',
    }));
    const { result } = renderHook(() => useLoginForm({ onLogin }));

    act(() => {
      result.current.setEmail(VALID_EMAIL);
      result.current.setPassword(VALID_PASSWORD);
    });
    await act(async () => {
      result.current.handleSubmit();
    });

    expect(result.current.uiError).toMatchObject({ status: 'locked', remainingSeconds: 300 });
    expect(result.current.isLocked).toBe(true);
    expect(result.current.isSubmitDisabled).toBe(true);
    expect(result.current.cooldownLabel).toBe('5:00');
  });

  it('retryAfterSeconds response는 throttled countdown과 disabled state를 시작한다', async () => {
    const onLogin = vi.fn(async () => ({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      retryAfterSeconds: 42,
      error: '너무 잦은 요청이에요. 42초 후 다시 시도해주세요.',
    }));
    const { result } = renderHook(() => useLoginForm({ onLogin }));

    act(() => {
      result.current.setEmail(VALID_EMAIL);
      result.current.setPassword(VALID_PASSWORD);
    });
    await act(async () => {
      result.current.handleSubmit();
    });

    expect(result.current.uiError).toMatchObject({ status: 'throttled', retryAfterSeconds: 42 });
    expect(result.current.isThrottled).toBe(true);
    expect(result.current.isSubmitDisabled).toBe(true);
    expect(result.current.cooldownLabel).toBe('0:42');
  });

  it('email 변경 시 locked/error state를 지운다', async () => {
    const onLogin = vi.fn(async () => ({
      success: false,
      locked: true,
      remainingSeconds: 300,
      error: '반복된 로그인 실패로 계정이 잠겼어요.',
    }));
    const { result } = renderHook(() => useLoginForm({ onLogin }));

    act(() => {
      result.current.setEmail(VALID_EMAIL);
      result.current.setPassword(VALID_PASSWORD);
    });
    await act(async () => {
      result.current.handleSubmit();
    });
    act(() => {
      result.current.setEmail('other@kangwon.ac.kr');
    });

    expect(result.current.uiError).toBeNull();
    expect(result.current.isLocked).toBe(false);
  });
});

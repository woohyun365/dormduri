import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/auth/api';
import { AUTH_SESSION_CHECK_TIMEOUT_MS, useAuthSession } from '../useAuthSession';

vi.mock('@/auth/api', () => ({
  authApi: {
    resolveSession: vi.fn(),
  },
}));

const mockResolveSession = vi.mocked(authApi.resolveSession);

const sessionUser = {
  id: 'user-1',
  email: 'user@kangwon.ac.kr',
  nickname: '테스터',
  gender: 'F',
  campus: 'CHUNCHEON',
} as const;

describe('useAuthSession', () => {
  beforeEach(() => {
    mockResolveSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('authenticated session이면 account identity만 반환한다', async () => {
    mockResolveSession.mockResolvedValue({ status: 'authenticated', user: sessionUser });

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(sessionUser);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).not.toHaveProperty('lifestyle');
    expect(result.current.user).not.toHaveProperty('dormitoryId');
    expect(result.current.user).not.toHaveProperty('intro');
  });

  it('unauthenticated session이면 null로 수렴한다', async () => {
    mockResolveSession.mockResolvedValue({ status: 'unauthenticated' });

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe('unauthenticated');
  });

  it('session API 실패는 raw error를 노출하지 않고 unavailable로 처리한다', async () => {
    mockResolveSession.mockRejectedValue(new Error('raw upstream stack'));

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current).toMatchObject({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
  });

  it('session 확인 timeout은 로그아웃 상태가 아니라 unavailable로 수렴한다', async () => {
    vi.useFakeTimers();
    mockResolveSession.mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTH_SESSION_CHECK_TIMEOUT_MS);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current).toMatchObject({
      user: null,
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
  });

  it('unmount cleanup은 진행 중인 session resolve를 abort한다', () => {
    let capturedSignal: AbortSignal | undefined;
    mockResolveSession.mockImplementation((signal) => {
      capturedSignal = signal;
      return new Promise(() => undefined);
    });

    const { unmount } = renderHook(() => useAuthSession());
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('retry는 unavailable 상태를 loading으로 되돌리고 session을 다시 확인한다', async () => {
    mockResolveSession
      .mockResolvedValueOnce({ status: 'unavailable', code: 'AUTH_SESSION_UNAVAILABLE' })
      .mockResolvedValueOnce({ status: 'authenticated', user: sessionUser });

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));

    act(() => result.current.retry());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(mockResolveSession).toHaveBeenCalledTimes(2);
  });
});

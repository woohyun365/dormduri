import { renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRedirectIfAuthenticated } from '../useRedirectIfAuthenticated';
import { useAuthSession } from '../useAuthSession';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('../useAuthSession', () => ({
  useAuthSession: vi.fn(),
}));

const mockUseAuthSession = vi.mocked(useAuthSession);

describe('useRedirectIfAuthenticated', () => {
  afterEach(() => {
    mockReplace.mockClear();
    mockUseAuthSession.mockReset();
  });

  it('로딩 중이면 isReadyToRender가 false이고 리다이렉트하지 않는다', () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      isLoading: true,
      status: 'loading',
      code: undefined,
      retry: vi.fn(),
    });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(result.current.isReadyToRender).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('인증된 session identity는 /main으로 리다이렉트되고 isReadyToRender가 false다', () => {
    mockUseAuthSession.mockReturnValue({
      user: {
        id: '1',
        email: 'tester@kangwon.ac.kr',
        nickname: 'tester',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      isLoading: false,
      status: 'authenticated',
      code: undefined,
      retry: vi.fn(),
    });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(mockReplace).toHaveBeenCalledWith('/main');
    expect(result.current.isReadyToRender).toBe(false);
  });

  it('비인증 사용자는 isReadyToRender가 true이고 리다이렉트하지 않는다', () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      isLoading: false,
      status: 'unauthenticated',
      code: undefined,
      retry: vi.fn(),
    });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(result.current.isReadyToRender).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('session unavailable은 auth flow를 유지하고 리다이렉트하지 않는다', () => {
    const retry = vi.fn();
    mockUseAuthSession.mockReturnValue({
      user: null,
      isLoading: false,
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
      retry,
    });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(result.current).toEqual({
      isReadyToRender: true,
      sessionStatus: 'unavailable',
      retrySession: retry,
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

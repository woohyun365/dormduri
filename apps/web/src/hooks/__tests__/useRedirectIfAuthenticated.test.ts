import { renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRedirectIfAuthenticated } from '../useRedirectIfAuthenticated';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);

describe('useRedirectIfAuthenticated', () => {
  afterEach(() => {
    mockReplace.mockClear();
  });

  it('로딩 중이면 isReadyToRender가 false이고 리다이렉트하지 않는다', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, setUser: vi.fn(), isLoading: true });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(result.current.isReadyToRender).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('인증된 사용자는 /로 리다이렉트되고 isReadyToRender가 false다', () => {
    mockUseCurrentUser.mockReturnValue({
      user: { id: '1', nickname: 'tester' } as ReturnType<typeof useCurrentUser>['user'],
      setUser: vi.fn(),
      isLoading: false,
    });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(result.current.isReadyToRender).toBe(false);
  });

  it('비인증 사용자는 isReadyToRender가 true이고 리다이렉트하지 않는다', () => {
    mockUseCurrentUser.mockReturnValue({ user: null, setUser: vi.fn(), isLoading: false });

    const { result } = renderHook(() => useRedirectIfAuthenticated());

    expect(result.current.isReadyToRender).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

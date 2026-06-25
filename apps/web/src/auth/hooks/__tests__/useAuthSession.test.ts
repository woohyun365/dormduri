import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { authApi } from '@/auth/api';
import { useAuthSession } from '../useAuthSession';

vi.mock('@/auth/api', () => ({
  authApi: {
    getSession: vi.fn(),
  },
}));

const mockGetSession = vi.mocked(authApi.getSession);

const sessionUser = {
  id: 'user-1',
  email: 'user@kangwon.ac.kr',
  nickname: '테스터',
  gender: 'F',
  campus: 'CHUNCHEON',
} as const;

describe('useAuthSession', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('authenticated session이면 account identity만 반환한다', async () => {
    mockGetSession.mockResolvedValue({ authenticated: true, user: sessionUser });

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(sessionUser);
    expect(result.current.user).not.toHaveProperty('lifestyle');
    expect(result.current.user).not.toHaveProperty('dormitoryId');
    expect(result.current.user).not.toHaveProperty('intro');
  });

  it('unauthenticated session이면 null로 수렴한다', async () => {
    mockGetSession.mockResolvedValue({ authenticated: false });

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
  });

  it('session API 실패는 raw error를 노출하지 않고 unauthenticated state로 처리한다', async () => {
    mockGetSession.mockRejectedValue(new Error('raw upstream stack'));

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
  });
});

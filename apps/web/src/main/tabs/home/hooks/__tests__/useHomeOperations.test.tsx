import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeOperationsApi } from '../../api/home-operations.api';
import { useHomeOperations } from '../useHomeOperations';

vi.mock('../../api/home-operations.api', () => ({
  homeOperationsApi: {
    getNotificationUnreadCount: vi.fn(),
  },
}));

describe('useHomeOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homeOperationsApi.getNotificationUnreadCount).mockResolvedValue({ unreadCount: 1 });
  });

  it('HomeTab entry에 필요한 unread count만 best-effort로 불러온다', async () => {
    const { result } = renderHook(() => useHomeOperations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(homeOperationsApi.getNotificationUnreadCount).toHaveBeenCalledTimes(1);
    expect(result.current.unreadNotificationCount).toBe(1);
  });

  it('count fetch가 실패해도 error state 대신 fallback 상태로 수렴한다', async () => {
    vi.mocked(homeOperationsApi.getNotificationUnreadCount).mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useHomeOperations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unreadNotificationCount).toBeNull();
  });
});

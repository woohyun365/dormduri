import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import { homeApi } from '@/api/home';
import { useMainHomeDashboard } from '../useMainHomeDashboard';

describe('useMainHomeDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the home dashboard read model through homeApi.getDashboard', async () => {
    const dashboard = createHomeDashboardFixture();
    const getDashboard = vi.spyOn(homeApi, 'getDashboard').mockResolvedValue(dashboard);

    const { result } = renderHook(() => useMainHomeDashboard());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.dashboard).toEqual(dashboard));

    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('keeps dashboard failures as a retryable safe UI message', async () => {
    vi.spyOn(homeApi, 'getDashboard').mockRejectedValue(new Error('raw upstream stack'));

    const { result } = renderHook(() => useMainHomeDashboard());

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.dashboard).toBeNull();
    expect(result.current.error).toBe('홈 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    expect(result.current.error).not.toContain('raw upstream stack');
  });
});

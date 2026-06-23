import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { HomeDashboardFetchError, homeApi } from '@/api/home';
import { useMainHomeDashboard } from '../useMainHomeDashboard';

describe('useMainHomeDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the home dashboard read model through homeApi.getDashboard', async () => {
    const dashboard = createHomeDashboardTestResponse();
    const getDashboard = vi.spyOn(homeApi, 'getDashboard').mockResolvedValue(dashboard);

    const { result } = renderHook(() => useMainHomeDashboard());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.dashboard).toEqual(dashboard));

    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('auth/permission dashboard failures use a safe re-login copy without leaking raw upstream details', async () => {
    vi.spyOn(homeApi, 'getDashboard').mockRejectedValue(
      new HomeDashboardFetchError(
        'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
        'raw AUTH_REQUIRED body with accessToken=secret',
        401,
      ),
    );

    const { result } = renderHook(() => useMainHomeDashboard());

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.error).toBe(
      '로그인이 만료되었거나 권한이 없어요. 다시 로그인한 뒤 이용해주세요.',
    );
    expect(result.current.error).not.toContain('accessToken');
    expect(result.current.error).not.toContain('AUTH_REQUIRED');
  });

  it('keeps the last successful dashboard while a retry fails with safe copy', async () => {
    const dashboard = createHomeDashboardTestResponse();
    const getDashboard = vi
      .spyOn(homeApi, 'getDashboard')
      .mockResolvedValueOnce(dashboard)
      .mockRejectedValueOnce(
        new HomeDashboardFetchError('HOME_DASHBOARD_UPSTREAM_UNAVAILABLE', 'raw 500 stack', 500),
      );

    const { result } = renderHook(() => useMainHomeDashboard());
    await waitFor(() => expect(result.current.dashboard).toEqual(dashboard));

    await act(async () => {
      await result.current.refetch();
    });

    expect(getDashboard).toHaveBeenCalledTimes(2);
    expect(result.current.dashboard).toEqual(dashboard);
    expect(result.current.error).toBe(
      '홈 정보를 불러오지 못했어요. 새로고침하거나 잠시 후 다시 시도해주세요.',
    );
    expect(result.current.error).not.toContain('raw 500 stack');
  });

  it('keeps dashboard failures as a retryable safe UI message', async () => {
    vi.spyOn(homeApi, 'getDashboard').mockRejectedValue(new Error('raw upstream stack'));

    const { result } = renderHook(() => useMainHomeDashboard());

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.dashboard).toBeNull();
    expect(result.current.error).toBe(
      '홈 정보를 불러오지 못했어요. 새로고침하거나 잠시 후 다시 시도해주세요.',
    );
    expect(result.current.error).not.toContain('raw upstream stack');
  });
});

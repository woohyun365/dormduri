import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { MainHomeRefreshCancelledError, useMainHomeDashboard } from '../useMainHomeDashboard';

const dashboard = createHomeDashboardTestResponse();
function input(overrides: Partial<Parameters<typeof useMainHomeDashboard>[0]> = {}) {
  return {
    viewerId: dashboard.viewer.identity.user.id,
    initialDashboard: dashboard,
    dashboardUnavailable: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

describe('useMainHomeDashboard server resource', () => {
  it('exposes meaningful server data on the first render without a browser fetch', () => {
    const props = input();
    const { result } = renderHook(() => useMainHomeDashboard(props));
    expect(result.current.dashboard).toEqual(dashboard);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('requests router refresh truthfully and remains pending until new server props arrive', async () => {
    const props = input();
    const { result, rerender } = renderHook(({ value }) => useMainHomeDashboard(value), {
      initialProps: { value: props },
    });
    let refreshCompletion: Promise<void> | undefined;
    act(() => {
      refreshCompletion = result.current.refetch();
    });
    expect(props.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);
    const next = structuredClone(dashboard);
    next.generatedAt = '2026-09-26T01:00:00.000Z';
    rerender({ value: input({ initialDashboard: next, refresh: props.refresh }) });
    await expect(refreshCompletion).resolves.toBeUndefined();
    expect(result.current.dashboard).toEqual(next);
    expect(result.current.refreshing).toBe(false);
  });

  it('retains same-viewer stale success on infrastructure failure with safe retry copy', () => {
    const props = input();
    const { result, rerender } = renderHook(({ value }) => useMainHomeDashboard(value), {
      initialProps: { value: props },
    });
    rerender({ value: input({ initialDashboard: null, dashboardUnavailable: true }) });
    expect(result.current.dashboard).toEqual(dashboard);
    expect(result.current.error).toBe(
      '홈 정보를 불러오지 못했어요. 새로고침하거나 잠시 후 다시 시도해주세요.',
    );
  });

  it('settles repeated unavailable refreshes when a new server snapshot has identical state fields', async () => {
    const refresh = vi.fn();
    const firstFailure = {};
    const { result, rerender } = renderHook(({ value }) => useMainHomeDashboard(value), {
      initialProps: {
        value: input({
          initialDashboard: null,
          dashboardUnavailable: true,
          resourceSnapshot: firstFailure,
          refresh,
        }),
      },
    });
    let firstCompletion: Promise<void> | undefined;
    act(() => {
      firstCompletion = result.current.refetch();
    });
    expect(result.current.refreshing).toBe(true);
    rerender({
      value: input({
        initialDashboard: null,
        dashboardUnavailable: true,
        resourceSnapshot: {},
        refresh,
      }),
    });
    await expect(firstCompletion).resolves.toBeUndefined();
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeTruthy();
    let secondCompletion: Promise<void> | undefined;
    act(() => {
      secondCompletion = result.current.refetch();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    rerender({
      value: input({
        initialDashboard: null,
        dashboardUnavailable: true,
        resourceSnapshot: {},
        refresh,
      }),
    });
    await expect(secondCompletion).resolves.toBeUndefined();
  });

  it('cancels a pending refresh when its authenticated runtime unmounts', async () => {
    const props = input();
    const { result, unmount } = renderHook(() => useMainHomeDashboard(props));
    let completion: Promise<void> | undefined;
    act(() => {
      completion = result.current.refetch();
    });

    unmount();

    await expect(completion).rejects.toBeInstanceOf(MainHomeRefreshCancelledError);
  });

  it('rejects a saved refresh callback after unmount without requesting navigation', async () => {
    const props = input();
    const { result, unmount } = renderHook(() => useMainHomeDashboard(props));
    const refetch = result.current.refetch;
    unmount();

    await expect(refetch()).rejects.toBeInstanceOf(MainHomeRefreshCancelledError);
    expect(props.refresh).not.toHaveBeenCalled();
  });

  it('does not accept a mismatched viewer dashboard', () => {
    const other = structuredClone(dashboard);
    other.viewer.identity.user.id = 'viewer-b';
    const { result } = renderHook(() => useMainHomeDashboard(input({ initialDashboard: other })));
    expect(result.current.dashboard).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('starts with a retryable error when the server has no safe dashboard', () => {
    const { result } = renderHook(() =>
      useMainHomeDashboard(input({ initialDashboard: null, dashboardUnavailable: true })),
    );
    expect(result.current.dashboard).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});

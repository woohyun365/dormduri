import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeDashboardResponse } from '@repo/shared/home';

const HOME_DASHBOARD_ERROR_MESSAGE =
  '홈 정보를 불러오지 못했어요. 새로고침하거나 잠시 후 다시 시도해주세요.';
type DashboardStatus = 'loading' | 'success' | 'error' | 'refreshing';

export class MainHomeRefreshCancelledError extends Error {
  constructor() {
    super('Main Home refresh was cancelled.');
    this.name = 'MainHomeRefreshCancelledError';
  }
}

export function isMainHomeRefreshCancelled(error: unknown) {
  return error instanceof MainHomeRefreshCancelledError;
}

interface MainHomeDashboardState {
  viewerId: string;
  source: object | null;
  dashboard: HomeDashboardResponse | null;
  status: DashboardStatus;
  error: string | null;
}

export interface UseMainHomeDashboardResult {
  dashboard: HomeDashboardResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMainHomeDashboard(input: {
  viewerId: string;
  initialDashboard: HomeDashboardResponse | null;
  dashboardUnavailable: boolean;
  resourceSnapshot?: object;
  refresh: () => void;
}): UseMainHomeDashboardResult {
  const source = input.resourceSnapshot ?? input.initialDashboard;
  const buildState = (previous?: MainHomeDashboardState): MainHomeDashboardState => {
    const validDashboard =
      input.initialDashboard?.viewer.identity.user.id === input.viewerId
        ? input.initialDashboard
        : null;
    if (validDashboard) {
      return {
        viewerId: input.viewerId,
        source,
        dashboard: validDashboard,
        status: 'success',
        error: null,
      };
    }
    if (input.dashboardUnavailable || input.initialDashboard) {
      return {
        viewerId: input.viewerId,
        source,
        dashboard: previous?.viewerId === input.viewerId ? previous.dashboard : null,
        status: 'error',
        error: HOME_DASHBOARD_ERROR_MESSAGE,
      };
    }
    return {
      viewerId: input.viewerId,
      source,
      dashboard: null,
      status: 'loading',
      error: null,
    };
  };
  const [state, setState] = useState<MainHomeDashboardState>(() => buildState());
  if (state.viewerId !== input.viewerId || state.source !== source) {
    setState(buildState(state));
  }

  const pendingRefresh = useRef<{
    source: object | null;
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: MainHomeRefreshCancelledError) => void;
  } | null>(null);
  const mounted = useRef(true);
  const lifecycleGeneration = useRef(0);
  const requestRefresh = input.refresh;

  const settleRefresh = useCallback(() => {
    const pending = pendingRefresh.current;
    if (!pending) return;
    pendingRefresh.current = null;
    pending.resolve();
  }, []);

  useEffect(() => {
    lifecycleGeneration.current += 1;
    mounted.current = true;
    return () => {
      mounted.current = false;
      const cleanupGeneration = (lifecycleGeneration.current += 1);
      queueMicrotask(() => {
        if (lifecycleGeneration.current !== cleanupGeneration || mounted.current) return;
        const pending = pendingRefresh.current;
        pendingRefresh.current = null;
        pending?.reject(new MainHomeRefreshCancelledError());
      });
    };
  }, []);

  useEffect(() => {
    if (pendingRefresh.current && pendingRefresh.current.source !== source) settleRefresh();
  }, [settleRefresh, source]);

  const refetch = useCallback(() => {
    if (!mounted.current) {
      const cancelled = Promise.reject<void>(new MainHomeRefreshCancelledError());
      void cancelled.catch(() => undefined);
      return cancelled;
    }
    if (pendingRefresh.current) return pendingRefresh.current.promise;
    setState((previous) => ({ ...previous, status: 'refreshing', error: null }));
    let resolvePromise: () => void = () => undefined;
    let rejectPromise: (error: MainHomeRefreshCancelledError) => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    // Some retry surfaces intentionally fire-and-forget. Mark cancellation as
    // observed here while preserving rejection for action callers that await it.
    void promise.catch(() => undefined);
    pendingRefresh.current = {
      source,
      promise,
      resolve: resolvePromise,
      reject: rejectPromise,
    };
    requestRefresh();
    return promise;
  }, [requestRefresh, source]);

  return {
    dashboard: state.dashboard,
    loading: state.status === 'loading',
    refreshing: state.status === 'refreshing',
    error: state.error,
    refetch,
  };
}

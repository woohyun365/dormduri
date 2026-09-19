import { useCallback, useEffect, useRef, useState } from 'react';
import { HomeDashboardFetchError, homeDashboardApi } from '@/main/api/home-dashboard.api';
import type { HomeDashboardResponse } from '@repo/shared/home';

const HOME_DASHBOARD_ERROR_MESSAGE =
  '홈 정보를 불러오지 못했어요. 새로고침하거나 잠시 후 다시 시도해주세요.';
const HOME_DASHBOARD_AUTH_ERROR_MESSAGE =
  '로그인이 만료되었거나 권한이 없어요. 다시 로그인한 뒤 이용해주세요.';
const HOME_DASHBOARD_NOT_FOUND_ERROR_MESSAGE =
  '현재 홈 정보를 찾을 수 없어요. 잠시 후 다시 시도해주세요.';

type DashboardStatus = 'loading' | 'success' | 'error' | 'refreshing';

function toSafeHomeDashboardErrorMessage(error: unknown): string {
  if (!(error instanceof HomeDashboardFetchError)) {
    return HOME_DASHBOARD_ERROR_MESSAGE;
  }

  if (error.status === 401 || error.status === 403) {
    return HOME_DASHBOARD_AUTH_ERROR_MESSAGE;
  }

  if (error.status === 404) {
    return HOME_DASHBOARD_NOT_FOUND_ERROR_MESSAGE;
  }

  return HOME_DASHBOARD_ERROR_MESSAGE;
}

interface MainHomeDashboardState {
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

export function useMainHomeDashboard(viewerId?: string): UseMainHomeDashboardResult {
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);
  const [state, setState] = useState<MainHomeDashboardState>({
    dashboard: null,
    status: 'loading',
    error: null,
  });

  const load = useCallback(
    async (initial = false) => {
      if (disposedRef.current) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (!initial) {
        setState((previous) => ({
          dashboard: previous.dashboard,
          status: 'refreshing',
          error: null,
        }));
      }

      try {
        const dashboard = await homeDashboardApi.getDashboard(controller.signal);
        if (requestIdRef.current !== requestId) return;
        if (viewerId && dashboard.viewer.identity.user.id !== viewerId) {
          setState({ dashboard: null, status: 'error', error: HOME_DASHBOARD_ERROR_MESSAGE });
          return;
        }
        setState({ dashboard, status: 'success', error: null });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        setState((previous) => ({
          dashboard: previous.dashboard,
          status: 'error',
          error: toSafeHomeDashboardErrorMessage(error),
        }));
      }
    },
    [viewerId],
  );

  useEffect(() => {
    disposedRef.current = false;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load(true);
      }
    });
    return () => {
      cancelled = true;
      disposedRef.current = true;
      abortRef.current?.abort();
      requestIdRef.current += 1;
    };
  }, [load]);

  return {
    dashboard: state.dashboard,
    loading: state.status === 'loading',
    refreshing: state.status === 'refreshing',
    error: state.error,
    refetch: () => load(false),
  };
}

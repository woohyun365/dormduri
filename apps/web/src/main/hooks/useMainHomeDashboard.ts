import { useCallback, useEffect, useRef, useState } from 'react';
import { homeApi } from '@/api/home';
import type { HomeDashboardResponse } from '@repo/shared/home';

const HOME_DASHBOARD_ERROR_MESSAGE = '홈 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

type DashboardStatus = 'loading' | 'success' | 'error' | 'refreshing';

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

export function useMainHomeDashboard(): UseMainHomeDashboardResult {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<MainHomeDashboardState>({
    dashboard: null,
    status: 'loading',
    error: null,
  });

  const load = useCallback(async (initial = false) => {
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
      const dashboard = await homeApi.getDashboard();
      if (requestIdRef.current !== requestId) return;
      setState({ dashboard, status: 'success', error: null });
    } catch {
      if (requestIdRef.current !== requestId) return;
      setState((previous) => ({
        dashboard: previous.dashboard,
        status: 'error',
        error: HOME_DASHBOARD_ERROR_MESSAGE,
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load(true);
      }
    });
    return () => {
      cancelled = true;
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

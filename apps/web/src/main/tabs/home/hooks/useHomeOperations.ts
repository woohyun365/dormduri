'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { homeOperationsApi } from '../api/home-operations.api';

export type HomeOperationsState = Readonly<{
  loading: boolean;
  refreshing: boolean;
  unreadNotificationCount: number | null;
}>;

export type HomeOperationsActions = Readonly<{
  refresh: () => Promise<void>;
}>;

const INITIAL_STATE: HomeOperationsState = {
  loading: true,
  refreshing: false,
  unreadNotificationCount: null,
};

export function useHomeOperations(): HomeOperationsState & HomeOperationsActions {
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const [state, setState] = useState<HomeOperationsState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({
      ...current,
      loading: current.unreadNotificationCount === null,
      refreshing: current.unreadNotificationCount !== null,
    }));

    try {
      const response = await homeOperationsApi.getNotificationUnreadCount();
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      setState({
        loading: false,
        refreshing: false,
        unreadNotificationCount: response.unreadCount,
      });
    } catch {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      setState({
        loading: false,
        refreshing: false,
        unreadNotificationCount: null,
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      mountedRef.current = false;
    };
  }, [refresh]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [refresh, state],
  );
}

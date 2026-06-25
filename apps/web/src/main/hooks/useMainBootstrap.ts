'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { profileApi } from '@/api/profile';
import type { UserProfile } from '@/types/profile';

export type MainBootstrapStatus = 'idle' | 'ready' | 'profile-incomplete' | 'error';

type MainBootstrapState = {
  sessionUserId: string | null;
  status: MainBootstrapStatus;
  profile: UserProfile | null;
};

const IDLE_STATE: MainBootstrapState = {
  sessionUserId: null,
  status: 'idle',
  profile: null,
};

export function useMainBootstrap({
  enabled,
  sessionUserId,
}: {
  enabled: boolean;
  sessionUserId: string | null;
}) {
  const [state, setState] = useState<MainBootstrapState>(IDLE_STATE);
  const [retryKey, setRetryKey] = useState(0);
  const currentSessionUserId = enabled ? sessionUserId : null;

  useEffect(() => {
    let cancelled = false;

    if (!currentSessionUserId) {
      return () => {
        cancelled = true;
      };
    }

    async function loadProfile() {
      try {
        const profile = await profileApi.getMyProfile();
        if (cancelled) return;

        if (!profile) {
          setState({
            sessionUserId: currentSessionUserId,
            status: 'profile-incomplete',
            profile: null,
          });
          return;
        }

        setState({ sessionUserId: currentSessionUserId, status: 'ready', profile });
      } catch {
        if (!cancelled) {
          setState({ sessionUserId: currentSessionUserId, status: 'error', profile: null });
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentSessionUserId, retryKey]);

  const retry = useCallback(() => {
    if (currentSessionUserId) {
      setState({ sessionUserId: currentSessionUserId, status: 'idle', profile: null });
      setRetryKey((value) => value + 1);
    }
  }, [currentSessionUserId]);

  const effectiveState = useMemo(() => {
    if (!currentSessionUserId || state.sessionUserId !== currentSessionUserId) {
      return IDLE_STATE;
    }

    return state;
  }, [currentSessionUserId, state]);

  return {
    profile: effectiveState.profile,
    status: effectiveState.status,
    isLoading: Boolean(currentSessionUserId) && effectiveState.status === 'idle',
    retry,
  };
}

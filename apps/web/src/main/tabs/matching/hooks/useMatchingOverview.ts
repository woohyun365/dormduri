'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchOverviewResponse } from '@repo/shared/match/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export interface MatchingOverviewClient {
  readonly getOverview: (signal?: AbortSignal) => Promise<MatchOverviewResponse>;
}

export function useMatchingOverview(
  options: {
    readonly client?: MatchingOverviewClient;
    readonly autoLoad?: boolean;
    readonly identityKey?: string;
  } = {},
) {
  const client = options.client ?? matchingApi;
  const identityKey = options.identityKey ?? 'default';
  const [state, setState] = useState<{
    readonly identityKey: string;
    readonly data: MatchOverviewResponse | null;
    readonly error: MatchingApiError | null;
    readonly loading: boolean;
  }>({
    identityKey,
    data: null,
    error: null,
    loading: options.autoLoad ?? true,
  });
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++sequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => ({
      identityKey,
      data: current.identityKey === identityKey ? current.data : null,
      error: null,
      loading: true,
    }));
    try {
      const next = await client.getOverview(controller.signal);
      if (sequence === sequenceRef.current && !controller.signal.aborted) {
        setState({ identityKey, data: next, error: null, loading: false });
      }
    } catch (caught) {
      if (sequence === sequenceRef.current && !controller.signal.aborted) {
        setState({
          identityKey,
          data: null,
          error:
            caught instanceof MatchingApiError
              ? caught
              : new MatchingApiError('MATCHING_API_NETWORK'),
          loading: false,
        });
      }
    }
  }, [client, identityKey]);
  useEffect(() => {
    let active = true;
    if (options.autoLoad ?? true) {
      queueMicrotask(() => {
        if (active) void refresh();
      });
    }
    return () => {
      active = false;
      sequenceRef.current += 1;
      abortRef.current?.abort();
    };
  }, [options.autoLoad, refresh]);
  const currentState = state.identityKey === identityKey ? state : null;
  return {
    data: currentState?.data ?? null,
    error: currentState?.error ?? null,
    loading: currentState?.loading ?? true,
    refresh,
  };
}

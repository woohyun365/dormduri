'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export interface MatchingHistoryClient {
  readonly getHistory: (signal?: AbortSignal) => Promise<MatchHistoryResponse>;
}
export function useMatchingHistory(
  options: { readonly client?: MatchingHistoryClient; readonly identityKey?: string } = {},
) {
  const client = options.client ?? matchingApi;
  const identityKey = options.identityKey ?? 'default';
  const [state, setState] = useState<{
    readonly identityKey: string;
    readonly data: MatchHistoryResponse | null;
    readonly error: MatchingApiError | null;
    readonly loading: boolean;
  }>({ identityKey, data: null, error: null, loading: false });
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  useEffect(
    () => () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, [identityKey]);
  const load = useCallback(async () => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
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
      const nextData = await client.getHistory(controller.signal);
      if (!controller.signal.aborted && sequenceRef.current === sequence) {
        setState({ identityKey, data: nextData, error: null, loading: false });
      }
    } catch (caught) {
      if (!controller.signal.aborted && sequenceRef.current === sequence) {
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
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [client, identityKey]);
  const currentState = state.identityKey === identityKey ? state : null;
  return {
    data: currentState?.data ?? null,
    error: currentState?.error ?? null,
    loading: currentState?.loading ?? false,
    load,
  };
}

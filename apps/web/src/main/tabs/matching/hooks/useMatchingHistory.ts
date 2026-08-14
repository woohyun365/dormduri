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
  const [data, setData] = useState<MatchHistoryResponse | null>(null);
  const [error, setError] = useState<MatchingApiError | null>(null);
  const [loading, setLoading] = useState(false);
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
    setData(null);
    setError(null);
    setLoading(false);
  }, [options.identityKey]);
  const load = useCallback(async () => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const nextData = await client.getHistory(controller.signal);
      if (!controller.signal.aborted && sequenceRef.current === sequence) setData(nextData);
    } catch (caught) {
      if (!controller.signal.aborted && sequenceRef.current === sequence)
        setError(
          caught instanceof MatchingApiError
            ? caught
            : new MatchingApiError('MATCHING_API_NETWORK'),
        );
    } finally {
      if (!controller.signal.aborted && sequenceRef.current === sequence) setLoading(false);
    }
  }, [client]);
  return { data, error, loading, load };
}

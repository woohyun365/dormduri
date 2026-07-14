'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchHistoryResponse } from '@repo/shared/match/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export interface MatchingHistoryClient {
  readonly getHistory: (signal?: AbortSignal) => Promise<MatchHistoryResponse>;
}
export function useMatchingHistory(options: { readonly client?: MatchingHistoryClient } = {}) {
  const client = options.client ?? matchingApi;
  const [data, setData] = useState<MatchHistoryResponse | null>(null);
  const [error, setError] = useState<MatchingApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      setData(await client.getHistory(controller.signal));
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(
          caught instanceof MatchingApiError
            ? caught
            : new MatchingApiError('MATCHING_API_NETWORK'),
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client]);
  return { data, error, loading, load };
}

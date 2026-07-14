'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchOverviewResponse } from '@repo/shared/match/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export interface MatchingOverviewClient {
  readonly getOverview: (signal?: AbortSignal) => Promise<MatchOverviewResponse>;
}

export function useMatchingOverview(
  options: { readonly client?: MatchingOverviewClient; readonly autoLoad?: boolean } = {},
) {
  const client = options.client ?? matchingApi;
  const [data, setData] = useState<MatchOverviewResponse | null>(null);
  const [error, setError] = useState<MatchingApiError | null>(null);
  const [loading, setLoading] = useState(options.autoLoad ?? true);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++sequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const next = await client.getOverview(controller.signal);
      if (sequence === sequenceRef.current && !controller.signal.aborted) setData(next);
    } catch (caught) {
      if (sequence === sequenceRef.current && !controller.signal.aborted)
        setError(
          caught instanceof MatchingApiError
            ? caught
            : new MatchingApiError('MATCHING_API_NETWORK'),
        );
    } finally {
      if (sequence === sequenceRef.current && !controller.signal.aborted) setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    if (options.autoLoad ?? true) void refresh();
    return () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
    };
  }, [options.autoLoad, refresh]);
  return { data, error, loading, refresh };
}

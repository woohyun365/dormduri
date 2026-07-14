'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicProfile } from '@repo/shared/profile/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export function useMatchingProfileDetail(
  options: { readonly client?: Pick<typeof matchingApi, 'getHistoryCounterpartProfile'> } = {},
) {
  const client = options.client ?? matchingApi;
  const [entryId, setEntryId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<MatchingApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const open = useCallback(
    async (nextEntryId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setEntryId(nextEntryId);
      setProfile(null);
      setError(null);
      setLoading(true);
      try {
        setProfile(await client.getHistoryCounterpartProfile(nextEntryId, controller.signal));
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
    },
    [client],
  );
  const close = useCallback(() => {
    abortRef.current?.abort();
    setEntryId(null);
    setProfile(null);
    setError(null);
    setLoading(false);
  }, []);
  return { entryId, profile, error, loading, open, close };
}

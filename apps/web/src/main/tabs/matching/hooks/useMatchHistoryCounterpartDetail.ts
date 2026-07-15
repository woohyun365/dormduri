'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicProfile } from '@repo/shared/profile/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export type MatchHistoryDetailState =
  | {
      readonly status: 'closed';
      readonly entryId: null;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'loading';
      readonly entryId: string;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'success';
      readonly entryId: string;
      readonly profile: PublicProfile;
      readonly error: null;
    }
  | {
      readonly status: 'error';
      readonly entryId: string;
      readonly profile: null;
      readonly error: MatchingApiError;
    };

export interface MatchHistoryCounterpartDetailClient {
  readonly getHistoryCounterpartProfile: (
    entryId: string,
    signal?: AbortSignal,
  ) => Promise<PublicProfile>;
}

const closedState: MatchHistoryDetailState = {
  status: 'closed',
  entryId: null,
  profile: null,
  error: null,
};

export function useMatchHistoryCounterpartDetail(
  options: { readonly client?: MatchHistoryCounterpartDetailClient } = {},
) {
  const client = options.client ?? matchingApi;
  const [state, setState] = useState<MatchHistoryDetailState>(closedState);
  const entryIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  useEffect(
    () => () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  const load = useCallback(
    (entryId: string) => {
      const normalizedEntryId = entryId.trim();
      if (!normalizedEntryId) return;
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      entryIdRef.current = normalizedEntryId;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading', entryId: normalizedEntryId, profile: null, error: null });

      void client
        .getHistoryCounterpartProfile(normalizedEntryId, controller.signal)
        .then((profile) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({ status: 'success', entryId: normalizedEntryId, profile, error: null });
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({
            status: 'error',
            entryId: normalizedEntryId,
            profile: null,
            error:
              caught instanceof MatchingApiError
                ? caught
                : new MatchingApiError('MATCHING_API_NETWORK'),
          });
        });
    },
    [client],
  );

  const open = useCallback((entryId: string) => load(entryId), [load]);
  const retry = useCallback(() => {
    if (entryIdRef.current) load(entryIdRef.current);
  }, [load]);
  const close = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    entryIdRef.current = null;
    setState(closedState);
  }, []);

  return { ...state, open, retry, close };
}

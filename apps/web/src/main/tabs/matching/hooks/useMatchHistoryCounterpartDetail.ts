'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicProfile } from '@repo/shared/profile/contract';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export type MatchHistoryDetailState =
  | {
      readonly status: 'closed';
      readonly entryId: null;
      readonly target: null;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'loading';
      readonly entryId: string;
      readonly target: MatchHistoryDetailTarget;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'success';
      readonly entryId: string;
      readonly target: MatchHistoryDetailTarget;
      readonly profile: PublicProfile;
      readonly error: null;
    }
  | {
      readonly status: 'error';
      readonly entryId: string;
      readonly target: MatchHistoryDetailTarget;
      readonly profile: null;
      readonly error: MatchingApiError;
    };

export interface MatchHistoryDetailTarget {
  readonly entryId: string;
  readonly nickname: string;
  readonly seasonName: string;
}

export interface MatchHistoryCounterpartDetailClient {
  readonly getHistoryCounterpartProfile: (
    entryId: string,
    signal?: AbortSignal,
  ) => Promise<PublicProfile>;
}

const closedState: MatchHistoryDetailState = {
  status: 'closed',
  entryId: null,
  target: null,
  profile: null,
  error: null,
};

export function useMatchHistoryCounterpartDetail(
  options: { readonly client?: MatchHistoryCounterpartDetailClient } = {},
) {
  const client = options.client ?? matchingApi;
  const [state, setState] = useState<MatchHistoryDetailState>(closedState);
  const targetRef = useRef<MatchHistoryDetailTarget | null>(null);
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
    (target: MatchHistoryDetailTarget) => {
      const normalizedEntryId = target.entryId.trim();
      if (!normalizedEntryId) return;
      const normalizedTarget = {
        entryId: normalizedEntryId,
        nickname: target.nickname.trim() || '과거 매칭 상대',
        seasonName: target.seasonName.trim() || '이전 시즌',
      } satisfies MatchHistoryDetailTarget;
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      targetRef.current = normalizedTarget;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({
        status: 'loading',
        entryId: normalizedEntryId,
        target: normalizedTarget,
        profile: null,
        error: null,
      });

      void client
        .getHistoryCounterpartProfile(normalizedEntryId, controller.signal)
        .then((profile) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({
            status: 'success',
            entryId: normalizedEntryId,
            target: normalizedTarget,
            profile,
            error: null,
          });
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({
            status: 'error',
            entryId: normalizedEntryId,
            target: normalizedTarget,
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

  const open = useCallback((target: MatchHistoryDetailTarget) => load(target), [load]);
  const retry = useCallback(() => {
    if (targetRef.current) load(targetRef.current);
  }, [load]);
  const close = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    targetRef.current = null;
    setState(closedState);
  }, []);

  return { ...state, open, retry, close };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviousSeasonProfileResponse } from '@repo/shared/season/participation';
import { MatchingApiError, matchingApi } from '../api/matching.api';

export interface MatchHistorySelfProfileTarget {
  readonly seasonId: string;
  readonly seasonName: string;
}

export interface MatchHistorySelfProfileClient {
  readonly getHistorySelfProfile: (
    seasonId: string,
    signal?: AbortSignal,
  ) => Promise<PreviousSeasonProfileResponse>;
}

export type MatchHistorySelfProfileState =
  | {
      readonly status: 'closed';
      readonly target: null;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'loading';
      readonly target: MatchHistorySelfProfileTarget;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'success';
      readonly target: MatchHistorySelfProfileTarget;
      readonly profile: PreviousSeasonProfileResponse;
      readonly error: null;
    }
  | {
      readonly status: 'error';
      readonly target: MatchHistorySelfProfileTarget;
      readonly profile: null;
      readonly error: MatchingApiError;
    };

const closedState: MatchHistorySelfProfileState = {
  status: 'closed',
  target: null,
  profile: null,
  error: null,
};

export function useMatchHistorySelfProfile(
  options: { readonly client?: MatchHistorySelfProfileClient } = {},
) {
  const client = options.client ?? matchingApi;
  const [state, setState] = useState<MatchHistorySelfProfileState>(closedState);
  const targetRef = useRef<MatchHistorySelfProfileTarget | null>(null);
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
    (target: MatchHistorySelfProfileTarget) => {
      const normalizedTarget = {
        seasonId: target.seasonId.trim(),
        seasonName: target.seasonName.trim() || '과거 시즌',
      } satisfies MatchHistorySelfProfileTarget;
      if (!normalizedTarget.seasonId) return;

      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      targetRef.current = normalizedTarget;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading', target: normalizedTarget, profile: null, error: null });

      void client
        .getHistorySelfProfile(normalizedTarget.seasonId, controller.signal)
        .then((profile) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({ status: 'success', target: normalizedTarget, profile, error: null });
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({
            status: 'error',
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

  const open = useCallback((target: MatchHistorySelfProfileTarget) => load(target), [load]);
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

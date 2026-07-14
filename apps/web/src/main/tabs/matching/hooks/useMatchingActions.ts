'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MatchingApiError, matchingApi } from '../api/matching.api';

type MatchingAction =
  | 'acceptRequest'
  | 'rejectRequest'
  | 'cancelRequest'
  | 'requestUnmatch'
  | 'cancelUnmatchRequest';
type MatchingActionsClient = Pick<typeof matchingApi, MatchingAction>;
export type MatchingActionRunResult = 'success' | 'state-changed' | 'error' | 'aborted';

export function useMatchingActions(options: {
  readonly client?: MatchingActionsClient;
  readonly refetchOverview: () => Promise<unknown>;
}) {
  const client = options.client ?? matchingApi;
  const refetchOverview = options.refetchOverview;
  const pendingRef = useRef(new Set<string>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const [pendingKeys, setPendingKeys] = useState<readonly string[]>([]);
  const [error, setError] = useState<MatchingApiError | null>(null);
  const sync = useCallback(() => setPendingKeys([...pendingRef.current]), []);
  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort());
    },
    [],
  );
  const run = useCallback(
    async (action: MatchingAction, id: string): Promise<MatchingActionRunResult> => {
      const key = `${action}:${id}`;
      if (pendingRef.current.has(key)) return 'aborted';
      const controller = new AbortController();
      pendingRef.current.add(key);
      controllersRef.current.set(key, controller);
      sync();
      setError(null);
      try {
        await client[action](id, controller.signal);
        await refetchOverview();
        return 'success';
      } catch (caught) {
        if (controller.signal.aborted) return 'aborted';
        const safe =
          caught instanceof MatchingApiError
            ? caught
            : new MatchingApiError('MATCHING_API_NETWORK');
        if (safe.code === 'MATCHING_API_STATE_CHANGED') {
          await refetchOverview();
          setError(safe);
          return 'state-changed';
        }
        setError(safe);
        return 'error';
      } finally {
        pendingRef.current.delete(key);
        controllersRef.current.delete(key);
        sync();
      }
    },
    [client, refetchOverview, sync],
  );
  return {
    pendingKeys,
    error,
    isPending: (action: MatchingAction, id: string) => pendingKeys.includes(`${action}:${id}`),
    accept: (id: string) => run('acceptRequest', id),
    reject: (id: string) => run('rejectRequest', id),
    cancel: (id: string) => run('cancelRequest', id),
    requestUnmatch: (id: string) => run('requestUnmatch', id),
    cancelUnmatchRequest: (id: string) => run('cancelUnmatchRequest', id),
    abort: (action: MatchingAction, id: string) =>
      controllersRef.current.get(`${action}:${id}`)?.abort(),
    dismissError: () => setError(null),
  };
}

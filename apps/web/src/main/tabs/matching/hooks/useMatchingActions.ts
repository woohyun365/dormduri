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

export function useMatchingActions(options: {
  readonly client?: MatchingActionsClient;
  readonly refetchOverview: () => Promise<unknown>;
}) {
  const client = options.client ?? matchingApi;
  const pendingRef = useRef(new Set<string>());
  const controllersRef = useRef(new Set<AbortController>());
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
    async (action: MatchingAction, id: string) => {
      const key = `${action}:${id}`;
      if (pendingRef.current.has(key)) return;
      const controller = new AbortController();
      pendingRef.current.add(key);
      controllersRef.current.add(controller);
      sync();
      setError(null);
      try {
        await client[action](id, controller.signal);
        await options.refetchOverview();
      } catch (caught) {
        if (!controller.signal.aborted) {
          const safe =
            caught instanceof MatchingApiError
              ? caught
              : new MatchingApiError('MATCHING_API_NETWORK');
          setError(safe);
          if (safe.code === 'MATCHING_API_STATE_CHANGED') await options.refetchOverview();
        }
      } finally {
        pendingRef.current.delete(key);
        controllersRef.current.delete(controller);
        sync();
      }
    },
    [client, options, sync],
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
    dismissError: () => setError(null),
  };
}

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
type MatchingActionScope = 'request' | 'active';

interface MatchingActionFailure {
  readonly scope: MatchingActionScope;
  readonly action: MatchingAction;
  readonly id: string;
  readonly error: MatchingApiError;
}

export interface UnmatchCompletion {
  readonly activeMatchId: string;
  readonly message: string;
}

export interface RequestActionCompletion {
  readonly action: 'rejectRequest' | 'cancelRequest';
  readonly requestId: string;
  readonly message: string;
}

export function useMatchingActions(options: {
  readonly client?: MatchingActionsClient;
  readonly refetchOverview: () => Promise<unknown>;
}) {
  const client = options.client ?? matchingApi;
  const refetchOverview = options.refetchOverview;
  const pendingRef = useRef(new Set<string>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const [pendingKeys, setPendingKeys] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<MatchingActionFailure | null>(null);
  const [requestCompletion, setRequestCompletion] = useState<RequestActionCompletion | null>(null);
  const [unmatchCompletion, setUnmatchCompletion] = useState<UnmatchCompletion | null>(null);
  const sync = useCallback(() => setPendingKeys([...pendingRef.current]), []);
  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort());
    },
    [],
  );
  const run = useCallback(
    async (action: MatchingAction, id: string): Promise<MatchingActionRunResult> => {
      const key = toPendingKey(action, id);
      if (pendingRef.current.has(key)) return 'aborted';
      const controller = new AbortController();
      pendingRef.current.add(key);
      controllersRef.current.set(key, controller);
      sync();
      setFailure(null);
      if (toActionScope(action) === 'request') setRequestCompletion(null);
      try {
        const response = await client[action](id, controller.signal);
        await refetchOverview();
        const activeMatch = response?.activeMatch;
        if (
          action === 'requestUnmatch' &&
          activeMatch?.status === 'UNMATCHED' &&
          activeMatch.endReason === 'UNMATCHED_BY_MUTUAL_CONSENT'
        ) {
          setUnmatchCompletion({
            activeMatchId: id,
            message: '두 사람 모두 동의해 매칭이 해제되었어요.',
          });
        }
        if (action === 'rejectRequest' || action === 'cancelRequest') {
          setRequestCompletion({
            action,
            requestId: id,
            message:
              action === 'rejectRequest'
                ? '매칭 요청을 거절했어요.'
                : '보낸 매칭 요청을 취소했어요.',
          });
        }
        return 'success';
      } catch (caught) {
        if (controller.signal.aborted) return 'aborted';
        const safe =
          caught instanceof MatchingApiError
            ? caught
            : new MatchingApiError('MATCHING_API_NETWORK');
        if (safe.code === 'MATCHING_API_STATE_CHANGED') {
          await refetchOverview();
          setFailure({ scope: toActionScope(action), action, id, error: safe });
          return 'state-changed';
        }
        setFailure({ scope: toActionScope(action), action, id, error: safe });
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
    error: failure?.error ?? null,
    requestError: failure?.scope === 'request' ? failure.error : null,
    activeError: failure?.scope === 'active' ? failure.error : null,
    requestCompletion,
    unmatchCompletion,
    isPending: (action: MatchingAction, id: string) =>
      pendingKeys.includes(toPendingKey(action, id)),
    accept: (id: string) => run('acceptRequest', id),
    reject: (id: string) => run('rejectRequest', id),
    cancel: (id: string) => run('cancelRequest', id),
    requestUnmatch: (id: string) => run('requestUnmatch', id),
    cancelUnmatchRequest: (id: string) => run('cancelUnmatchRequest', id),
    abort: (action: MatchingAction, id: string) =>
      controllersRef.current.get(toPendingKey(action, id))?.abort(),
    dismissError: () => setFailure(null),
    dismissRequestError: () =>
      setFailure((current) => (current?.scope === 'request' ? null : current)),
    dismissActiveError: () =>
      setFailure((current) => (current?.scope === 'active' ? null : current)),
    dismissRequestCompletion: () => setRequestCompletion(null),
    dismissUnmatchCompletion: () => setUnmatchCompletion(null),
  };
}

function toActionScope(action: MatchingAction): MatchingActionScope {
  return action === 'requestUnmatch' || action === 'cancelUnmatchRequest' ? 'active' : 'request';
}

function toPendingKey(action: MatchingAction, id: string): string {
  return toActionScope(action) === 'active' ? `active:${id}` : `${action}:${id}`;
}

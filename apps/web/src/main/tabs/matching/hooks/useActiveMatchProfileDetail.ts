'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicProfile } from '@repo/shared/profile/contract';
import {
  getCurrentMatchedProfileDetail,
  type CurrentMatchedProfileDetailQuery,
} from '../../roommate-list/api/roommateProfileDetail.client';
import {
  createRoommateApiError,
  isRoommateApiError,
} from '../../roommate-list/api/roommateApiErrors';
import type {
  RoommateProfileDetailState,
  RoommateProfileDetailTarget,
} from '../../roommate-list/hooks/useRoommateProfileDetail';
import type { MatchingActiveView } from '../model/matching-active-view';

interface ActiveMatchProfileClient {
  readonly getCurrentMatchedProfileDetail: (
    query: CurrentMatchedProfileDetailQuery,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<PublicProfile>;
}

const defaultActiveMatchProfileClient: ActiveMatchProfileClient = {
  getCurrentMatchedProfileDetail,
};

const closedState: RoommateProfileDetailState = {
  status: 'closed',
  target: null,
  profile: null,
  error: null,
};

export function useActiveMatchProfileDetail(
  options: { readonly client?: ActiveMatchProfileClient } = {},
) {
  const client = options.client ?? defaultActiveMatchProfileClient;
  const [state, setState] = useState<RoommateProfileDetailState>(closedState);
  const targetRef = useRef<RoommateProfileDetailTarget | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runFetch = useCallback(
    (target: RoommateProfileDetailTarget) => {
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      targetRef.current = target;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading', target, profile: null, error: null });

      void client
        .getCurrentMatchedProfileDetail(
          { targetUserId: target.targetUserId },
          { signal: controller.signal },
        )
        .then((profile) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({ status: 'success', target, profile, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || sequenceRef.current !== sequence) return;
          setState({
            status: 'error',
            target,
            profile: null,
            error: isRoommateApiError(error)
              ? error
              : createRoommateApiError({ code: 'UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR' }),
          });
        });
    },
    [client],
  );

  const open = useCallback(
    (activeMatch: MatchingActiveView, trigger: HTMLButtonElement) => {
      if (!activeMatch.canOpenProfile) return;
      triggerRef.current = trigger;
      runFetch({
        targetUserId: activeMatch.counterpartUserId,
        nickname: activeMatch.nickname,
        detailEntryToken: null,
      });
    },
    [runFetch],
  );

  const close = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    targetRef.current = null;
    setState(closedState);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else {
        const fallback =
          document.getElementById('matching-active-heading') ??
          document.getElementById('matching-tab-heading');
        fallback?.focus({ preventScroll: true });
      }
    });
  }, []);

  const retry = useCallback(() => {
    if (targetRef.current) runFetch(targetRef.current);
  }, [runFetch]);

  return { ...state, open, close, retry };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRoommateProfileDetail,
  type RoommateProfileDetailQuery,
} from '../api/roommateProfileDetail.client';
import { createRoommateApiError } from '../api/roommateApiErrors';
import { isRoommateApiError, type RoommateApiError } from '../api/roommateSearch.client';
import type { PublicProfile } from '@repo/shared/profile/contract';

export interface RoommateProfileDetailTarget {
  readonly targetUserId: string;
  readonly nickname: string;
  readonly detailEntryToken: string | null;
}

export type RoommateProfileDetailState =
  | {
      readonly status: 'closed';
      readonly target: null;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'loading';
      readonly target: RoommateProfileDetailTarget;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: 'success';
      readonly target: RoommateProfileDetailTarget;
      readonly profile: PublicProfile;
      readonly error: null;
    }
  | {
      readonly status: 'error';
      readonly target: RoommateProfileDetailTarget;
      readonly profile: null;
      readonly error: RoommateApiError;
    };

export interface RoommateProfileDetailClientPort {
  readonly getRoommateProfileDetail: (
    query: RoommateProfileDetailQuery,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<PublicProfile>;
}

export interface UseRoommateProfileDetailOptions {
  readonly client?: RoommateProfileDetailClientPort;
}

export type UseRoommateProfileDetailResult = RoommateProfileDetailState & {
  readonly isOpen: boolean;
  readonly open: (target: RoommateProfileDetailTarget) => void;
  readonly close: () => void;
  readonly retry: () => void;
};

const CLOSED_STATE: RoommateProfileDetailState = {
  status: 'closed',
  target: null,
  profile: null,
  error: null,
};

const defaultRoommateProfileDetailClient: RoommateProfileDetailClientPort = {
  getRoommateProfileDetail,
};

export function useRoommateProfileDetail(
  options: UseRoommateProfileDetailOptions = {},
): UseRoommateProfileDetailResult {
  const client = options.client ?? defaultRoommateProfileDetailClient;
  const [state, setState] = useState<RoommateProfileDetailState>(CLOSED_STATE);
  const targetRef = useRef<RoommateProfileDetailTarget | null>(null);
  const sequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      sequenceRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      targetRef.current = null;
    };
  }, []);

  const runFetch = useCallback(
    (target: RoommateProfileDetailTarget) => {
      const sanitizedTarget = {
        ...target,
        targetUserId: target.targetUserId.trim(),
        detailEntryToken: target.detailEntryToken?.trim() || null,
      } satisfies RoommateProfileDetailTarget;
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      abortRef.current?.abort();
      targetRef.current = sanitizedTarget;

      if (!sanitizedTarget.targetUserId || !sanitizedTarget.detailEntryToken) {
        setState({
          status: 'error',
          target: sanitizedTarget,
          profile: null,
          error: createRoommateApiError({
            code: 'ROOMMATE_PROFILE_DETAIL_ENTRY_REQUIRED',
            status: 400,
          }),
        });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading', target: sanitizedTarget, profile: null, error: null });

      void client
        .getRoommateProfileDetail(
          {
            targetUserId: sanitizedTarget.targetUserId,
            detailEntryToken: sanitizedTarget.detailEntryToken,
          },
          { signal: controller.signal },
        )
        .then((profile) => {
          if (sequenceRef.current !== sequence || controller.signal.aborted) return;
          setState({ status: 'success', target: sanitizedTarget, profile, error: null });
        })
        .catch((error: unknown) => {
          if (sequenceRef.current !== sequence || controller.signal.aborted) return;
          const safeError = isRoommateApiError(error)
            ? error
            : createRoommateApiError({ code: 'UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR' });
          setState({ status: 'error', target: sanitizedTarget, profile: null, error: safeError });
        });
    },
    [client],
  );

  const open = useCallback(
    (target: RoommateProfileDetailTarget) => {
      runFetch(target);
    },
    [runFetch],
  );

  const close = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    targetRef.current = null;
    setState(CLOSED_STATE);
  }, []);

  const retry = useCallback(() => {
    if (!targetRef.current) return;
    runFetch(targetRef.current);
  }, [runFetch]);

  return {
    ...state,
    isOpen: state.status !== 'closed',
    open,
    close,
    retry,
  };
}

import { useEffect, useState } from 'react';
import { homeProfileDetailApi } from '../api/home-profile-detail.api';
import type { PublicProfile } from '@repo/shared/profile/contract';
import type {
  PreviousSeasonProfileResponse,
  SeasonProfileDraftResponse,
} from '@repo/shared/season/participation';

export type HomeProfileDetailState<T> =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

interface InternalDetailState<T> {
  requestKey: string;
  result: HomeProfileDetailState<T>;
}

function createIdleState<T>(): HomeProfileDetailState<T> {
  return { status: 'idle', data: null, error: null };
}

function createLoadingState<T>(): HomeProfileDetailState<T> {
  return { status: 'loading', data: null, error: null };
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('프로필 상세 정보를 불러오지 못했어요.');
}

function resolveStateForKey<T>(
  state: InternalDetailState<T>,
  requestKey: string | null,
): HomeProfileDetailState<T> {
  if (!requestKey) return createIdleState();
  if (state.requestKey !== requestKey) return createLoadingState();
  return state.result;
}

export function useCurrentSeasonProfileDetail(
  enabled: boolean,
): HomeProfileDetailState<SeasonProfileDraftResponse> {
  const requestKey = enabled ? 'current-season-profile' : null;
  const [state, setState] = useState<InternalDetailState<SeasonProfileDraftResponse>>(() => ({
    requestKey: 'idle',
    result: createIdleState(),
  }));

  useEffect(() => {
    if (!requestKey) return;

    let active = true;

    homeProfileDetailApi
      .getCurrentSeasonProfile()
      .then((data) => {
        if (active) setState({ requestKey, result: { status: 'success', data, error: null } });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            requestKey,
            result: { status: 'error', data: null, error: normalizeError(error) },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [requestKey]);

  return resolveStateForKey(state, requestKey);
}

export function usePreviousSeasonProfileDetail(
  enabled: boolean,
): HomeProfileDetailState<PreviousSeasonProfileResponse> {
  const requestKey = enabled ? 'previous-season-profile' : null;
  const [state, setState] = useState<InternalDetailState<PreviousSeasonProfileResponse>>(() => ({
    requestKey: 'idle',
    result: createIdleState(),
  }));

  useEffect(() => {
    if (!requestKey) return;

    let active = true;

    homeProfileDetailApi
      .getPreviousSeasonProfile()
      .then((data) => {
        if (active) setState({ requestKey, result: { status: 'success', data, error: null } });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            requestKey,
            result: { status: 'error', data: null, error: normalizeError(error) },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [requestKey]);

  return resolveStateForKey(state, requestKey);
}

export function usePublicProfileDetail(
  userId: string | null | undefined,
  enabled: boolean,
): HomeProfileDetailState<PublicProfile> {
  const requestKey = enabled && userId ? `public-profile:${userId}` : null;
  const [state, setState] = useState<InternalDetailState<PublicProfile>>(() => ({
    requestKey: 'idle',
    result: createIdleState(),
  }));

  useEffect(() => {
    if (!requestKey || !userId) return;

    let active = true;

    homeProfileDetailApi
      .getPublicProfileByUserId(userId)
      .then((data) => {
        if (active) setState({ requestKey, result: { status: 'success', data, error: null } });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            requestKey,
            result: { status: 'error', data: null, error: normalizeError(error) },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [requestKey, userId]);

  return resolveStateForKey(state, requestKey);
}

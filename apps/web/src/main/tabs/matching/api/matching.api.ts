import {
  activeMatchActionResponseSchema,
  activeMatchResponseSchema,
  createMatchRequestSchema,
  matchHistoryResponseSchema,
  matchOverviewResponseSchema,
  matchRequestActionResponseSchema,
  type ActiveMatchActionResponse,
  type ActiveMatchResponse,
  type CreateMatchRequestRequest,
  type MatchHistoryResponse,
  type MatchOverviewResponse,
  type MatchRequestActionResponse,
} from '@repo/shared/match/contract';
import { publicProfileSchema, type PublicProfile } from '@repo/shared/profile/contract';
import {
  previousSeasonProfileResponseSchema,
  type PreviousSeasonProfileResponse,
} from '@repo/shared/season/participation';

export type MatchingApiErrorCode =
  | 'MATCHING_API_ABORTED'
  | 'MATCHING_API_NETWORK'
  | 'MATCHING_API_RESPONSE_INVALID'
  | 'MATCHING_API_STATE_CHANGED'
  | 'MATCHING_HISTORY_DETAIL_UNAVAILABLE';

export class MatchingApiError extends Error {
  constructor(
    readonly code: MatchingApiErrorCode,
    readonly status?: number,
  ) {
    super(toMatchingApiErrorMessage(code));
    this.name = 'MatchingApiError';
  }
}

export function toMatchingApiErrorMessage(code: MatchingApiErrorCode): string {
  switch (code) {
    case 'MATCHING_API_ABORTED':
      return '요청이 취소되었어요.';
    case 'MATCHING_API_STATE_CHANGED':
      return '매칭 상태가 변경되었어요. 최신 상태를 다시 확인해주세요.';
    case 'MATCHING_HISTORY_DETAIL_UNAVAILABLE':
      return '이 기록의 상대 프로필은 더 이상 확인할 수 없어요.';
    case 'MATCHING_API_NETWORK':
      return '매칭 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
    case 'MATCHING_API_RESPONSE_INVALID':
      return '매칭 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.';
  }
}

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

async function fetchMatchingJson<T>(input: {
  path: string;
  method: 'GET' | 'POST';
  schema: SafeParseSchema<T>;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input.path, {
      method: input.method,
      headers: input.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      cache: 'no-store',
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new MatchingApiError('MATCHING_API_ABORTED');
    }
    throw new MatchingApiError('MATCHING_API_NETWORK');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MatchingApiError('MATCHING_API_RESPONSE_INVALID', response.status);
  }

  if (!response.ok) {
    const upstreamCode =
      typeof payload === 'object' && payload !== null && 'code' in payload
        ? (payload as { code?: unknown }).code
        : null;
    const historyDetailUnavailable =
      input.path.includes('/api/matches/history/entries/') &&
      (upstreamCode === 'MATCH_HISTORY_ENTRY_ACCESS_DENIED' ||
        upstreamCode === 'MATCH_HISTORY_ENTRY_NOT_FOUND' ||
        upstreamCode === 'MATCH_HISTORY_PROFILE_NOT_AVAILABLE');
    throw new MatchingApiError(
      historyDetailUnavailable
        ? 'MATCHING_HISTORY_DETAIL_UNAVAILABLE'
        : response.status === 409 || response.status === 422
          ? 'MATCHING_API_STATE_CHANGED'
          : 'MATCHING_API_NETWORK',
      response.status,
    );
  }

  const parsed = input.schema.safeParse(payload);
  if (!parsed.success) {
    throw new MatchingApiError('MATCHING_API_RESPONSE_INVALID', response.status);
  }
  return parsed.data;
}

function requestAction(
  requestId: string,
  action: 'accept' | 'reject' | 'cancel',
  signal?: AbortSignal,
): Promise<MatchRequestActionResponse> {
  return fetchMatchingJson({
    path: `/api/matches/requests/${encodeURIComponent(requestId)}/${action}`,
    method: 'POST',
    schema: matchRequestActionResponseSchema,
    signal,
  });
}

export const matchingApi = {
  getOverview(signal?: AbortSignal): Promise<MatchOverviewResponse> {
    return fetchMatchingJson({
      path: '/api/matches/overview',
      method: 'GET',
      schema: matchOverviewResponseSchema,
      signal,
    });
  },
  getActive(signal?: AbortSignal): Promise<ActiveMatchResponse> {
    return fetchMatchingJson({
      path: '/api/matches/active',
      method: 'GET',
      schema: activeMatchResponseSchema,
      signal,
    });
  },
  getHistory(signal?: AbortSignal): Promise<MatchHistoryResponse> {
    return fetchMatchingJson({
      path: '/api/matches/history',
      method: 'GET',
      schema: matchHistoryResponseSchema,
      signal,
    });
  },
  getHistoryCounterpartProfile(entryId: string, signal?: AbortSignal): Promise<PublicProfile> {
    return fetchMatchingJson({
      path: `/api/matches/history/entries/${encodeURIComponent(entryId)}/counterpart-profile`,
      method: 'GET',
      schema: publicProfileSchema,
      signal,
    });
  },
  getHistorySelfProfile(
    seasonId: string,
    signal?: AbortSignal,
  ): Promise<PreviousSeasonProfileResponse> {
    return fetchMatchingJson({
      path: `/api/seasons/${encodeURIComponent(seasonId)}/profile/me`,
      method: 'GET',
      schema: previousSeasonProfileResponseSchema,
      signal,
    });
  },
  createRequest(
    input: CreateMatchRequestRequest,
    signal?: AbortSignal,
  ): Promise<MatchRequestActionResponse> {
    const parsed = createMatchRequestSchema.safeParse(input);
    if (!parsed.success)
      return Promise.reject(new MatchingApiError('MATCHING_API_RESPONSE_INVALID'));
    return fetchMatchingJson({
      path: '/api/matches/requests',
      method: 'POST',
      schema: matchRequestActionResponseSchema,
      body: parsed.data,
      signal,
    });
  },
  acceptRequest(requestId: string, signal?: AbortSignal): Promise<MatchRequestActionResponse> {
    return requestAction(requestId, 'accept', signal);
  },
  rejectRequest(requestId: string, signal?: AbortSignal): Promise<MatchRequestActionResponse> {
    return requestAction(requestId, 'reject', signal);
  },
  cancelRequest(requestId: string, signal?: AbortSignal): Promise<MatchRequestActionResponse> {
    return requestAction(requestId, 'cancel', signal);
  },
  requestUnmatch(activeMatchId: string, signal?: AbortSignal): Promise<ActiveMatchActionResponse> {
    return fetchMatchingJson({
      path: `/api/matches/active/${encodeURIComponent(activeMatchId)}/unmatch-request`,
      method: 'POST',
      schema: activeMatchActionResponseSchema,
      signal,
    });
  },
  cancelUnmatchRequest(
    activeMatchId: string,
    signal?: AbortSignal,
  ): Promise<ActiveMatchActionResponse> {
    return fetchMatchingJson({
      path: `/api/matches/active/${encodeURIComponent(activeMatchId)}/unmatch-request/cancel`,
      method: 'POST',
      schema: activeMatchActionResponseSchema,
      signal,
    });
  },
};

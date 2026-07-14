import type { MatchHistoryResponse, MatchOverviewResponse } from '@repo/shared/match/contract';
import type { MatchingApiError } from '../api/matching.api';
import {
  toMatchingRequestSectionView,
  type MatchingRequestSectionView,
} from './matching-request-view';
import { getMatchingSeasonStateRule } from './matching-state-matrix';

export interface MatchHistorySummary {
  readonly seasons: number;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
}

export interface CurrentMatchingView {
  readonly activeMatch: MatchOverviewResponse['activeMatch'];
  readonly serverNow: string;
  readonly roomSelectionDate: string | null;
  readonly requestSection: MatchingRequestSectionView;
  readonly receivedPendingCount: number;
}

export type MatchingViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: MatchingApiError }
  | {
      readonly kind: 'unavailable';
      readonly reason: NonNullable<MatchOverviewResponse['capability']['reason']>;
    }
  | { readonly kind: 'off-season'; readonly historySummary: MatchHistorySummary }
  | { readonly kind: 'season-open'; readonly historySummary: MatchHistorySummary }
  | { readonly kind: 'season-matching'; readonly current: CurrentMatchingView }
  | {
      readonly kind: 'season-post-match';
      readonly activeMatch: MatchOverviewResponse['activeMatch'];
      readonly historySummary: MatchHistorySummary;
    };

export function summarizeMatchHistory(
  history: MatchHistoryResponse | null | undefined,
): MatchHistorySummary {
  const items = history?.items ?? [];
  return {
    seasons: items.length,
    matchedCount: items.filter((item) => item.finalResult === 'MATCHED_SUCCESS').length,
    unmatchedCount: items.filter((item) => item.finalResult === 'UNMATCHED_AFTER_SUCCESS').length,
  };
}

export function partitionCurrentRequests(overview: MatchOverviewResponse): CurrentMatchingView {
  const pendingReceived = overview.receivedRequests.filter(
    (request) => request.status === 'PENDING',
  );
  return {
    activeMatch: overview.activeMatch,
    serverNow: overview.serverNow,
    roomSelectionDate: overview.season.roomSelectionDate,
    requestSection: toMatchingRequestSectionView({
      sentRequests: overview.sentRequests,
      receivedRequests: overview.receivedRequests,
    }),
    receivedPendingCount: pendingReceived.length,
  };
}

export function toMatchingViewState(input: {
  readonly overview?: MatchOverviewResponse | null;
  readonly history?: MatchHistoryResponse | null;
  readonly error?: MatchingApiError | null;
  readonly loading?: boolean;
}): MatchingViewState {
  if (input.loading && !input.overview) return { kind: 'loading' };
  if (input.error) return { kind: 'error', error: input.error };
  if (!input.overview) return { kind: 'loading' };
  if (!input.overview.capability.canViewMatching) {
    if (!input.overview.capability.reason)
      throw new Error('Unavailable matching overview requires a reason');
    return { kind: 'unavailable', reason: input.overview.capability.reason };
  }

  const historySummary = summarizeMatchHistory(input.history);
  switch (getMatchingSeasonStateRule(input.overview.season.state).view) {
    case 'off-season':
      return { kind: 'off-season', historySummary };
    case 'season-open':
      return { kind: 'season-open', historySummary };
    case 'season-matching':
      return { kind: 'season-matching', current: partitionCurrentRequests(input.overview) };
    case 'season-post-match':
      return { kind: 'season-post-match', activeMatch: input.overview.activeMatch, historySummary };
  }
}

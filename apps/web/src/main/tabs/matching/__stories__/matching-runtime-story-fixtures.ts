import type { StoryObj } from '@storybook/nextjs-vite';
import type { CurrentActiveMatchSummary } from '@repo/shared/match/contract';
import { MatchingApiError } from '../api/matching.api';
import { MatchingTabView } from '../MatchingTab';
import type { MatchingViewState } from '../model/matching-view-model';

export const matchingHistorySummary = { seasons: 2, matchedCount: 1, unmatchedCount: 0 } as const;

export const matchingActiveMatch: CurrentActiveMatchSummary = {
  id: 'runtime-match-1',
  seasonId: 'season-2026-2',
  counterpartUserId: 'runtime-user-2',
  counterpartParticipantId: 'runtime-participant-2',
  counterpartNickname: '도윤',
  status: 'ACTIVE',
  startedAt: '2026-08-04T03:00:00.000Z',
  endedAt: null,
  endReason: null,
  createdFromRequestId: 'runtime-request-1',
  unmatchProgress: {
    state: 'NONE',
    requestedByViewerAt: null,
    requestedByCounterpartAt: null,
    progressCount: 0,
    requiredCount: 2,
    canRequest: false,
    canCancel: false,
    disabledReason: null,
    availableUntil: null,
  },
};

export function matchingRuntimeStory(state: MatchingViewState): StoryObj<typeof MatchingTabView> {
  return { args: { state } };
}

export const matchingSystemStates = {
  loading: { kind: 'loading' } as const,
  error: { kind: 'error', error: new MatchingApiError('MATCHING_API_NETWORK') } as const,
  denied: { kind: 'unavailable', reason: 'VIEWER_NOT_REGISTERED' } as const,
};

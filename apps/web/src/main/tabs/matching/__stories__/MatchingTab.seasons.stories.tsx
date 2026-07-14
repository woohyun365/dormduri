import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MatchingApiError } from '../api/matching.api';
import { MatchingTabView } from '../MatchingTab';
import type { MatchingViewState } from '../model/matching-view-model';

const historySummary = { seasons: 2, matchedCount: 1, unmatchedCount: 0 } as const;
const activeMatch = {
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
    availableUntil: null,
  },
} as const;

const meta = {
  title: 'Main/MatchingTab/Runtime/SeasonStates',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'BFF shared contract에서 파생된 canonical MatchingTab shell과 four-season/system state를 검증합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(state: MatchingViewState): Story {
  return { args: { state } };
}

export const OffSeason = story({ kind: 'off-season', historySummary });
export const SeasonOpen = story({ kind: 'season-open', historySummary });
export const SeasonMatchingEmpty = story({
  kind: 'season-matching',
  current: {
    activeMatch: null,
    serverNow: '2026-08-01T00:00:00.000Z',
    roomSelectionDate: '2026-08-10',
    requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
    receivedPendingCount: 0,
  },
});
export const SeasonPostMatchActive = story({
  kind: 'season-post-match',
  activeMatch,
  historySummary,
});
export const SeasonPostMatchEmpty = story({
  kind: 'season-post-match',
  activeMatch: null,
  historySummary,
});
export const Loading = story({ kind: 'loading' });
export const Error = story({
  kind: 'error',
  error: new MatchingApiError('MATCHING_API_NETWORK'),
});
Error.args = { ...Error.args, onRetry: async () => undefined };
export const Denied = story({ kind: 'unavailable', reason: 'VIEWER_NOT_REGISTERED' });
export const PartialCounterpart = story({
  kind: 'season-post-match',
  activeMatch: { ...activeMatch, counterpartNickname: undefined },
  historySummary,
});

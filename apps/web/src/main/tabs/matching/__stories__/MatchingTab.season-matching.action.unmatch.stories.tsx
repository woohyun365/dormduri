import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import {
  createMatchingActiveMatch,
  createSeasonMatchingCurrent,
  matchingSeasonStory,
} from './matching-season-story-fixtures';
import { offSeasonHistoryContent } from './matching-off-season-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Action/Unmatch',
  component: MatchingTabView,
} satisfies Meta<typeof MatchingTabView>;

export default meta;

export const ViewerRequested = matchingSeasonStory(
  {
    kind: 'season-matching',
    current: createSeasonMatchingCurrent({
      activeMatch: createMatchingActiveMatch({
        unmatchProgress: {
          ...createMatchingActiveMatch().unmatchProgress,
          state: 'WAITING_FOR_COUNTERPART',
          requestedByViewerAt: '2026-08-02T03:00:00.000Z',
          progressCount: 1,
          canRequest: false,
          canCancel: true,
        },
      }),
    }),
  },
  'season-matching:unmatch-progress',
  { pastContent: offSeasonHistoryContent(), onNavigateChat: () => undefined },
);

export const CounterpartRequested = matchingSeasonStory(
  {
    kind: 'season-matching',
    current: createSeasonMatchingCurrent({
      activeMatch: createMatchingActiveMatch({
        unmatchProgress: {
          ...createMatchingActiveMatch().unmatchProgress,
          state: 'WAITING_FOR_ME',
          requestedByCounterpartAt: '2026-08-02T03:00:00.000Z',
          progressCount: 1,
        },
      }),
    }),
  },
  'season-matching:unmatch-progress',
  { pastContent: offSeasonHistoryContent(), onNavigateChat: () => undefined },
);

export const CutoffClosed = matchingSeasonStory(
  {
    kind: 'season-matching',
    current: createSeasonMatchingCurrent({
      activeMatch: createMatchingActiveMatch({
        unmatchProgress: {
          ...createMatchingActiveMatch().unmatchProgress,
          canRequest: false,
          disabledReason: 'ROOM_SELECTION_CUTOFF',
        },
      }),
    }),
  },
  'season-matching:active-pair',
  { pastContent: offSeasonHistoryContent(), onNavigateChat: () => undefined },
);

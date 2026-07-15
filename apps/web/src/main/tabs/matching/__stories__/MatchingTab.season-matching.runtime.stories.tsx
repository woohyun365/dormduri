import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { matchingActiveMatch, matchingRuntimeStory } from './matching-runtime-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Runtime',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_MATCHING의 current request/ACTIVE pair runtime입니다. 세부 action matrix는 Requests/Active stories가 소유합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
export const NoMatchingActivity = matchingRuntimeStory({
  kind: 'season-matching',
  current: {
    activeMatch: null,
    serverNow: '2026-08-01T00:00:00.000Z',
    roomSelectionDate: '2026-08-10',
    requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
    receivedPendingCount: 0,
  },
});
export const ActivePair = matchingRuntimeStory({
  kind: 'season-matching',
  current: {
    activeMatch: matchingActiveMatch,
    serverNow: '2026-08-04T03:00:00.000Z',
    roomSelectionDate: '2026-08-10',
    requestSection: { quota: { used: 0, limit: 3, remaining: 3 }, sent: [], received: [] },
    receivedPendingCount: 0,
  },
});

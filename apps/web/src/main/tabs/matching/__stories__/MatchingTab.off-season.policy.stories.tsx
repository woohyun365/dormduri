import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent, offSeasonStoryState } from './matching-off-season-story-support';
import { matchingSeasonStory } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Off Season/Policy',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Policy scenarios for a viewer with no current season. Matching requests and responses stay unavailable while ended-season history remains read-only.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type OffSeasonPolicyStory = StoryObj<typeof MatchingTabView>;

export const NoCurrentSeason: OffSeasonPolicyStory = {
  ...matchingSeasonStory(offSeasonStoryState, 'off-season:policy', {
    selectedSection: 'current',
    pastContent: offSeasonHistoryContent(),
  }),
  name: 'No Current Season',
};

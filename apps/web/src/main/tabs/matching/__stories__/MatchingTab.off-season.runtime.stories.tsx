import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { matchingHistorySummary, matchingRuntimeStory } from './matching-runtime-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Off Season/Runtime',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component: 'OFF_SEASON의 canonical matching runtime 안내와 history summary입니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
export const CurrentSeasonClosed = matchingRuntimeStory({
  kind: 'off-season',
  historySummary: matchingHistorySummary,
});

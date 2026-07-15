import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { matchingHistorySummary, matchingRuntimeStory } from './matching-runtime-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Season Open/Runtime',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_OPEN에서는 profile/registration 준비만 가능하고 match action은 열리지 않습니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
export const RegistrationAndExploreGuidance = matchingRuntimeStory({
  kind: 'season-open',
  historySummary: matchingHistorySummary,
});

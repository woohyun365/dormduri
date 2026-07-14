import type { Meta } from '@storybook/nextjs-vite';
import { createMatchingStory, MatchingTabStorySurface } from './matching-story-renderer';
import { matchingTabStoryScenarios } from './matching-story-scenarios';

const meta = {
  title: 'Main/MatchingTab/Baseline/Legacy/UnsupportedGroup',
  component: MatchingTabStorySurface,
  parameters: {
    docs: {
      description: {
        component:
          '출시되지 않은 3인 group UI의 historical comparison 전용 story입니다. product runtime, canonical story matrix, acceptance 근거가 아닙니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabStorySurface>;

export default meta;

export const SeasonMatchingGroupLegacy = createMatchingStory(
  matchingTabStoryScenarios.seasonMatchingGroupLegacy,
);

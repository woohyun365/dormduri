import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { matchingRuntimeStory, matchingSystemStates } from './matching-runtime-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/System',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Matching BFF loading/error/unavailable 상태는 season scenario와 분리해 검증합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
export const Loading = matchingRuntimeStory(matchingSystemStates.loading);
export const ErrorRecovery = {
  ...matchingRuntimeStory(matchingSystemStates.error),
  args: { state: matchingSystemStates.error, onRetry: async () => undefined },
};
export const ViewerUnavailable = matchingRuntimeStory(matchingSystemStates.denied);

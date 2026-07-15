import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import {
  matchingActiveMatch,
  matchingHistorySummary,
  matchingRuntimeStory,
} from './matching-runtime-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Post Match/Runtime',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_POST_MATCH은 신규 match action이 아니라 확정 결과 확인을 위한 read-only 기간입니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
export const ActiveResult = matchingRuntimeStory({
  kind: 'season-post-match',
  activeMatch: matchingActiveMatch,
  historySummary: matchingHistorySummary,
});
export const NoResult = matchingRuntimeStory({
  kind: 'season-post-match',
  activeMatch: null,
  historySummary: matchingHistorySummary,
});

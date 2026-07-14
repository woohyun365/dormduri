import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRoommateStory, RoommateListTabStorySurface } from './roommate-story-renderer';
import { roommateStoryScenarios } from './roommate-story-scenarios';

const meta = {
  title: 'Main/RoommateTab/Season Matching/Action/MatchRequest',
  component: RoommateListTabStorySurface,
  parameters: {
    docs: {
      description: {
        component:
          'DB seed나 로그인 세션 없이 RoommateTab의 search/bookmark/detail/action policy state를 빠르게 비교하기 위한 story-only visual workshop입니다. 실제 BFF/API/auth 통합 정합성은 targeted test와 full-stack smoke가 소유합니다.',
      },
    },
  },
  argTypes: {
    scenario: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof RoommateListTabStorySurface>;
export default meta;

type Story = StoryObj<typeof RoommateListTabStorySurface>;

export const MatchRequestDialog: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestDialog,
);
export const MatchRequestPending: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestPending,
);
export const MatchRequestSuccess: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestSuccess,
);
export const PendingRequests: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingPendingRequests,
);
export const MatchRequestFailed: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestFailed,
);
export const MatchRequestAlreadyPendingRace: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestAlreadyPending,
);
export const MatchRequestLimitReached: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestLimitReached,
);
export const MatchRequestTargetMatched: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestTargetMatched,
);
export const MatchRequestTargetDeregistered: Story = createRoommateStory(
  roommateStoryScenarios.seasonMatchingMatchRequestTargetDeregistered,
);

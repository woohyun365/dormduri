import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRoommateStory, RoommateListTabStorySurface } from './roommate-story-renderer';
import { roommateStoryScenarios } from './roommate-story-scenarios';

const meta = {
  title: 'Main/RoommateTab/Season Open/Search',
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

export const Registered: Story = createRoommateStory(roommateStoryScenarios.seasonOpenRegistered);
export const RegisteredChatting: Story = createRoommateStory(
  roommateStoryScenarios.seasonOpenRegisteredChatting,
);
export const NotRegistered: Story = createRoommateStory(
  roommateStoryScenarios.seasonOpenNotRegistered,
);
export const Deregistered: Story = createRoommateStory(
  roommateStoryScenarios.seasonOpenDeregistered,
);
export const RegisteredEmpty: Story = createRoommateStory(
  roommateStoryScenarios.seasonOpenRegisteredEmpty,
);
export const SearchError: Story = createRoommateStory(roommateStoryScenarios.seasonOpenSearchError);
export const LoadingSkeleton: Story = createRoommateStory(
  roommateStoryScenarios.seasonOpenLoadingSkeleton,
);

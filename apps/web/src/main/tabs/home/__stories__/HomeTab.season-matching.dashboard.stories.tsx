import type { Meta } from '@storybook/nextjs-vite';
import {
  createHomeStory,
  HOME_TAB_STORY_DESCRIPTION,
  HomeTabStorySurface,
  type HomeTabStory,
} from './home-story-renderer';
import { homeStoryScenarios } from './home-story-scenarios';

const meta = {
  title: 'Main/HomeTab/Season Matching/Dashboard',
  component: HomeTabStorySurface,
  parameters: {
    docs: {
      description: {
        component: HOME_TAB_STORY_DESCRIPTION,
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
} satisfies Meta<typeof HomeTabStorySurface>;
export default meta;

type Story = HomeTabStory;

export const SeasonMatchingProfileAndDormitoryRequired: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingProfileAndDormitoryRequired,
);
export const SeasonMatchingProfileRequired: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingProfileRequired,
);
export const SeasonMatchingDormitoryRequired: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingDormitoryRequired,
);
export const SeasonMatchingRegistrationReady: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegistrationReady,
);
export const SeasonMatchingRegisteredNoActivity: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegisteredNoActivity,
);
export const SeasonMatchingRegisteredProgress40: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegisteredProgress40,
);
export const SeasonMatchingRegisteredProgress75: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegisteredProgress75,
);
export const SeasonMatchingRegisteredProgress92: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegisteredProgress92,
);
export const SeasonMatchingDeregistered: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingDeregistered,
);
export const SeasonMatchingUnmatched: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingUnmatched,
);
export const SeasonMatchingRegisteredS1R0C1: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegisteredS1R0C1,
);
export const SeasonMatchingRegisteredS1R1C1: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegisteredS1R1C1,
);
export const SeasonMatchingActiveMatch: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingActiveMatch,
);
export const SeasonMatchingActiveMatchCounterpartCancelRequest: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingActiveMatchCounterpartCancelRequest,
);
export const SeasonMatchingActiveMatchSelfCancelRequest: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingActiveMatchSelfCancelRequest,
);
export const SeasonMatchingRegistrationUnavailable: Story = createHomeStory(
  homeStoryScenarios.seasonMatchingRegistrationUnavailable,
);
export const ProfileCounterpartError: Story = createHomeStory(
  homeStoryScenarios.profileCounterpartError,
);

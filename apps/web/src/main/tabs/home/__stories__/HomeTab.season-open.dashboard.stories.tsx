import type { Meta } from '@storybook/nextjs-vite';
import {
  createHomeStory,
  HOME_TAB_STORY_DESCRIPTION,
  HomeTabStorySurface,
  type HomeTabStory,
} from './home-story-renderer';
import { homeStoryScenarios } from './home-story-scenarios';

const meta = {
  title: 'Main/HomeTab/Season Open/Dashboard',
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

export const SeasonOpenProfileAndDormitoryRequired: Story = createHomeStory(
  homeStoryScenarios.seasonOpenProfileAndDormitoryRequired,
);
export const SeasonOpenDormitoryRequired: Story = createHomeStory(
  homeStoryScenarios.seasonOpenDormitoryRequired,
);
export const SeasonOpenProfileRequired: Story = createHomeStory(
  homeStoryScenarios.seasonOpenProfileRequired,
);
export const SeasonOpenRegistrationReady: Story = createHomeStory(
  homeStoryScenarios.seasonOpenRegistrationReady,
);
export const SeasonOpenRegisteredPreview: Story = createHomeStory(
  homeStoryScenarios.seasonOpenRegisteredPreview,
);
export const SeasonOpenDeregistered: Story = createHomeStory(
  homeStoryScenarios.seasonOpenDeregistered,
);
export const SeasonOpenNoMatchingSeason: Story = createHomeStory(
  homeStoryScenarios.seasonOpenNoMatchingSeason,
);
export const SeasonOpenNoOperatedDormitoriesProfileIncomplete: Story = createHomeStory(
  homeStoryScenarios.seasonOpenNoOperatedDormitoriesProfileIncomplete,
);
export const SeasonOpenNoOperatedDormitoriesProfileComplete: Story = createHomeStory(
  homeStoryScenarios.seasonOpenNoOperatedDormitoriesProfileComplete,
);

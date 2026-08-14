import type { Meta } from '@storybook/nextjs-vite';
import {
  createHomeStory,
  HOME_TAB_STORY_DESCRIPTION,
  HomeTabStorySurface,
  type HomeTabStory,
} from './home-story-renderer';
import { homeStoryScenarios } from './home-story-scenarios';

const meta = {
  title: 'Main/HomeTab/Off Season/Dashboard',
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

export const OffSeasonNextSeason: Story = createHomeStory(homeStoryScenarios.offSeasonNextSeason);
export const OffSeasonNoNextSeason: Story = createHomeStory(
  homeStoryScenarios.offSeasonNoNextSeason,
);
export const OffSeasonNextSeasonNoServiceHistory: Story = createHomeStory(
  homeStoryScenarios.offSeasonNextSeasonNoServiceHistory,
);
export const OffSeasonNextSeasonNoUserHistory: Story = createHomeStory(
  homeStoryScenarios.offSeasonNextSeasonNoUserHistory,
);
export const OffSeasonNextSeasonUserMatchedHistory: Story = createHomeStory(
  homeStoryScenarios.offSeasonNextSeasonUserMatchedHistory,
);
export const OffSeasonNoNextSeasonNoServiceHistory: Story = createHomeStory(
  homeStoryScenarios.offSeasonNoNextSeasonNoServiceHistory,
);
export const NonOperatedCampus: Story = createHomeStory(homeStoryScenarios.nonOperatedCampus);

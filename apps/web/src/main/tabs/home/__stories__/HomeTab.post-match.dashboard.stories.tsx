import type { Meta } from '@storybook/nextjs-vite';
import {
  createHomeStory,
  HOME_TAB_STORY_DESCRIPTION,
  HomeTabStorySurface,
  type HomeTabStory,
} from './home-story-renderer';
import { homeStoryScenarios } from './home-story-scenarios';

const meta = {
  title: 'Main/HomeTab/Post Match/Dashboard',
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

export const PostMatchNotRegistered: Story = createHomeStory(
  homeStoryScenarios.postMatchNotRegistered,
);
export const PostMatchDeregistered: Story = createHomeStory(
  homeStoryScenarios.postMatchDeregistered,
);
export const PostMatchMatched: Story = createHomeStory(homeStoryScenarios.postMatchMatched);
export const PostMatchUnmatched: Story = createHomeStory(homeStoryScenarios.postMatchUnmatched);
export const PostMatchRegisteredNotMatched: Story = createHomeStory(
  homeStoryScenarios.postMatchRegisteredNotMatched,
);
export const PostMatchUserHistory: Story = createHomeStory(homeStoryScenarios.postMatchUserHistory);
export const PostMatchRegistrationUnavailable: Story = createHomeStory(
  homeStoryScenarios.postMatchRegistrationUnavailable,
);

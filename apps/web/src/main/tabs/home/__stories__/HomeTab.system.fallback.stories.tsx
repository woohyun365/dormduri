import type { Meta } from '@storybook/nextjs-vite';
import {
  ErrorRecovery,
  HOME_TAB_STORY_DESCRIPTION,
  HomeTabStorySurface,
  LoadingSkeleton,
  type HomeTabStory,
} from './home-story-renderer';

const meta = {
  title: 'Main/HomeTab/System/Fallback',
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

export const Loading: Story = LoadingSkeleton;
export const Error: Story = ErrorRecovery;

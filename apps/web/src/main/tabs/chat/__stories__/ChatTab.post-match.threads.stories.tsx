import type { Meta } from '@storybook/nextjs-vite';
import { ChatTabStorySurface, createChatStory } from './chat-story-renderer';
import { chatStoryScenarios } from './chat-story-scenarios';

const meta = {
  title: 'Main/ChatTab/Post Match/Threads',
  component: ChatTabStorySurface,
} satisfies Meta<typeof ChatTabStorySurface>;

export default meta;
export const MatchedPairOpenUntilSeasonEnd = createChatStory(
  chatStoryScenarios.postMatchMatchedOpen,
);
export const ReadOnlyAndArchivedHistory = createChatStory(
  chatStoryScenarios.postMatchReadOnlyHistory,
);

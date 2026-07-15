import type { Meta } from '@storybook/nextjs-vite';
import { ChatTabStorySurface, createChatStory } from './chat-story-renderer';
import { chatStoryScenarios } from './chat-story-scenarios';

const meta = {
  title: 'Main/ChatTab/Off Season/Threads',
  component: ChatTabStorySurface,
} satisfies Meta<typeof ChatTabStorySurface>;

export default meta;
export const ArchivedHistoryOnly = createChatStory(chatStoryScenarios.offSeasonArchived);
export const Empty = createChatStory(chatStoryScenarios.offSeasonEmpty);

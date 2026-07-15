import type { Meta } from '@storybook/nextjs-vite';
import { ChatTabStorySurface, createChatStory } from './chat-story-renderer';
import { chatStoryScenarios } from './chat-story-scenarios';

const meta = {
  title: 'Main/ChatTab/Season Matching/Safety',
  component: ChatTabStorySurface,
} satisfies Meta<typeof ChatTabStorySurface>;

export default meta;
export const ChatThreadReport = createChatStory(chatStoryScenarios.seasonMatchingReport);

import type { Meta } from '@storybook/nextjs-vite';
import { ChatTabStorySurface, createChatStory } from './chat-story-renderer';
import { chatStoryScenarios } from './chat-story-scenarios';

const meta = {
  title: 'Main/ChatTab/System',
  component: ChatTabStorySurface,
} satisfies Meta<typeof ChatTabStorySurface>;

export default meta;
export const ListErrorAndRetry = createChatStory(chatStoryScenarios.systemListError);
export const MemberUnavailableDetail = createChatStory(chatStoryScenarios.systemMemberUnavailable);

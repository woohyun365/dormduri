import type { Meta } from '@storybook/nextjs-vite';
import { ChatTabStorySurface, createChatStory } from './chat-story-renderer';
import { chatStoryScenarios } from './chat-story-scenarios';

const meta = {
  title: 'Main/ChatTab/Season Matching/Threads',
  component: ChatTabStorySurface,
} satisfies Meta<typeof ChatTabStorySurface>;

export default meta;
export const DirectThreadOpen = createChatStory(chatStoryScenarios.seasonMatchingDirect);
export const DirectThreadReadOnlyAfterCutoff = createChatStory(
  chatStoryScenarios.seasonMatchingDirectCutoff,
);
export const MatchedPairThreadOpen = createChatStory(chatStoryScenarios.seasonMatchingMatched);
export const OwnerCursorPagination = createChatStory(chatStoryScenarios.seasonMatchingPagination);

'use client';

import { useEffect } from 'react';
import type { StoryObj } from '@storybook/nextjs-vite';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import ChatTab from '../ChatTab';
import { useChatStoryApiFixtures } from './chat-story-api-fixtures';
import type { ChatStoryScenario } from './chat-story-scenarios';
import { viewerId } from './chat-story-scenarios';

export function ChatTabStorySurface({ scenario }: { scenario: ChatStoryScenario }) {
  useChatStoryApiFixtures(scenario);
  useChatStoryAutoOpen(scenario);

  return (
    <SeasonProvider value={scenario.seasonContext}>
      <div className="min-h-screen bg-(--knu-background-alt) py-4 sm:px-4">
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-4xl border border-(--knu-border) bg-white shadow-sm">
          <ChatTab viewerId={viewerId} onNavigate={() => undefined} />
        </div>
      </div>
    </SeasonProvider>
  );
}

export function createChatStory(scenario: ChatStoryScenario) {
  return {
    name: scenario.title,
    args: { scenario },
    parameters: {
      docs: { description: { story: scenario.description } },
    },
  } satisfies StoryObj<typeof ChatTabStorySurface>;
}

function useChatStoryAutoOpen(scenario: ChatStoryScenario) {
  useEffect(() => {
    if (!scenario.autoOpen || typeof window === 'undefined') return;
    let cancelled = false;
    const run = async () => {
      const thread = await waitForButton(/대화 상대/u, () => cancelled);
      if (!thread) return;
      thread.click();
      if (scenario.autoOpen === 'report-dialog') {
        const report = await waitForButton(/^신고하기$/u, () => cancelled);
        report?.click();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [scenario.autoOpen, scenario.key]);
}

async function waitForButton(pattern: RegExp, isCancelled: () => boolean) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (isCancelled()) return null;
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      pattern.test(
        `${candidate.getAttribute('aria-label') ?? ''} ${candidate.textContent ?? ''}`.trim(),
      ),
    );
    if (button && !button.disabled) return button;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return null;
}

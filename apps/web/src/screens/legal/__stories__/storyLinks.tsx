import { useEffect } from 'react';
import type { Decorator } from '@storybook/nextjs-vite';
import { storyVersionKeys } from './storyDocuments';

// Storybook only: the screens link to real addresses (/privacy, /terms, ?version=<versionKey>) that the
// Storybook server does not serve. A click on one of them opens the story that shows that page
// instead (Owner 2026-11-16). Product code and the addresses stay as they are.
const storyForAddress: Record<string, string> = {
  '/': 'landing-page--default',
  '/privacy': 'legal-page--privacy',
  '/terms': 'legal-page--terms',
  [`/privacy?version=${storyVersionKeys.privacyScheduled}`]:
    'legal-page--privacy-viewing-scheduled',
  [`/terms?version=${storyVersionKeys.termsScheduled}`]: 'legal-page--terms-viewing-scheduled',
  [`/privacy?version=${storyVersionKeys.privacyPrevious}`]: 'legal-page--privacy-viewing-previous',
  [`/terms?version=${storyVersionKeys.termsPrevious}`]: 'legal-page--terms-viewing-previous',
};

// Storybook pages, not Next.js routes: the manager shows the story, a bare iframe (tests) loads it.
function openStory(id: string) {
  const manager = window.top !== null && window.top !== window ? window.top : null;
  if (manager) {
    manager.location.assign(new URL(`/?path=/story/${id}`, manager.location.origin));
  } else {
    window.location.assign(new URL(`/iframe.html?id=${id}&viewMode=story`, window.location.origin));
  }
}

function StoryLinks({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest('a');
      const href = anchor?.getAttribute('href');
      const id = href ? storyForAddress[href] : undefined;
      if (!id) return;
      event.preventDefault();
      openStory(id);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return <>{children}</>;
}

export const withStoryLinks: Decorator = (Story) => (
  <StoryLinks>
    <Story />
  </StoryLinks>
);

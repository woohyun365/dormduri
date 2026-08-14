import type { PublicProfile } from '@repo/shared/profile/contract';
import { useEffect, useLayoutEffect } from 'react';

const MATCHING_STORY_PROFILE_FETCH_KEY = '__knuMatchingStoryProfileFetch__';
const useStoryFetchEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type MatchingStoryProfileFetchStore = {
  originalFetch: typeof fetch;
  refCount: number;
  profileByTargetUserId: Readonly<Record<string, PublicProfile>>;
};

export function useMatchingStoryProfileApiFixtures(
  profileByTargetUserId: Readonly<Record<string, PublicProfile>>,
) {
  useStoryFetchEffect(() => {
    if (typeof window === 'undefined') return;

    const globalStore = globalThis as typeof globalThis & {
      [MATCHING_STORY_PROFILE_FETCH_KEY]?: MatchingStoryProfileFetchStore;
    };
    const existingStore = globalStore[MATCHING_STORY_PROFILE_FETCH_KEY];

    if (existingStore) {
      existingStore.refCount += 1;
      existingStore.profileByTargetUserId = profileByTargetUserId;
      return () => releaseMatchingStoryProfileFetchShim(globalStore);
    }

    const originalFetch = window.fetch;
    globalStore[MATCHING_STORY_PROFILE_FETCH_KEY] = {
      originalFetch,
      refCount: 1,
      profileByTargetUserId,
    };

    window.fetch = async (input, init) => {
      const request = resolveStoryRequest(input, init);
      const activeStore = globalStore[MATCHING_STORY_PROFILE_FETCH_KEY];

      if (request.method === 'GET' && /^\/api\/profiles\/[^/]+$/.test(request.pathname)) {
        const targetUserId = decodeURIComponent(request.pathname.split('/').at(-1) ?? '');
        const profile = activeStore?.profileByTargetUserId[targetUserId];
        if (profile) return Response.json(profile);
      }

      if (request.method === 'POST' && /^\/api\/blocks\/[^/]+$/.test(request.pathname)) {
        const targetUserId = decodeURIComponent(request.pathname.split('/').at(-1) ?? '');
        return Response.json({
          block: {
            id: `story-block-${targetUserId}`,
            blockedUserId: targetUserId,
            blockedAt: '2026-08-01T03:00:00.000Z',
            note: null,
          },
          created: true,
          listMetadata: { serverTime: '2026-08-01T03:00:00.000Z' },
        });
      }

      return originalFetch.call(window, input, init);
    };

    return () => releaseMatchingStoryProfileFetchShim(globalStore);
  }, [profileByTargetUserId]);
}

function releaseMatchingStoryProfileFetchShim(
  globalStore: typeof globalThis & {
    [MATCHING_STORY_PROFILE_FETCH_KEY]?: MatchingStoryProfileFetchStore;
  },
) {
  const store = globalStore[MATCHING_STORY_PROFILE_FETCH_KEY];
  if (!store) return;

  store.refCount -= 1;
  if (store.refCount <= 0) {
    window.fetch = store.originalFetch;
    delete globalStore[MATCHING_STORY_PROFILE_FETCH_KEY];
  }
}

function resolveStoryRequest(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(rawUrl, window.location.origin);

  return {
    method: (
      init?.method ?? (typeof input === 'string' || input instanceof URL ? 'GET' : input.method)
    ).toUpperCase(),
    pathname: url.pathname,
  };
}

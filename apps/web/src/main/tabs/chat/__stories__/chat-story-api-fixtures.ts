'use client';

import { useEffect, useLayoutEffect } from 'react';
import type { ChatStoryScenario } from './chat-story-scenarios';

const STORE_KEY = '__knuChatTabStoryFetch__';
const useStoryFetchEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Store = { originalFetch: typeof fetch; refCount: number; scenario: ChatStoryScenario };

export function useChatStoryApiFixtures(scenario: ChatStoryScenario) {
  useStoryFetchEffect(() => {
    if (typeof window === 'undefined') return;
    const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
    if (globalStore[STORE_KEY]) {
      globalStore[STORE_KEY].refCount += 1;
      globalStore[STORE_KEY].scenario = scenario;
      return () => release(globalStore);
    }

    const originalFetch = window.fetch.bind(window);
    globalStore[STORE_KEY] = { originalFetch: window.fetch, refCount: 1, scenario };
    window.fetch = async (input, init) => {
      const request = toRequest(input, init);
      const response = resolveResponse(request, globalStore[STORE_KEY]?.scenario ?? scenario);
      return response ?? originalFetch(input, init);
    };
    return () => release(globalStore);
  }, [scenario]);
}

function release(globalStore: typeof globalThis & { [STORE_KEY]?: Store }) {
  const store = globalStore[STORE_KEY];
  if (!store) return;
  store.refCount -= 1;
  if (store.refCount <= 0) {
    window.fetch = store.originalFetch;
    delete globalStore[STORE_KEY];
  }
}

function toRequest(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(rawUrl, window.location.origin);
  return {
    method: (
      init?.method ?? (typeof input === 'string' || input instanceof URL ? 'GET' : input.method)
    ).toUpperCase(),
    pathname: url.pathname,
    searchParams: url.searchParams,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveResponse(
  request: ReturnType<typeof toRequest>,
  scenario: ChatStoryScenario,
): Response | null {
  if (request.method === 'GET' && request.pathname === '/api/chat/threads') {
    const cursor = request.searchParams.get('cursor');
    if (cursor && scenario.pageError)
      return json({ code: scenario.pageError.code }, scenario.pageError.status);
    if (!cursor && scenario.listError)
      return json({ code: scenario.listError.code }, scenario.listError.status);
    return json(
      cursor
        ? (scenario.pages?.[cursor] ?? {
            items: [],
            pageInfo: { hasNextPage: false, nextCursor: null },
          })
        : scenario.list,
    );
  }
  const detailMatch = request.pathname.match(/^\/api\/chat\/threads\/([^/]+)$/);
  if (request.method === 'GET' && detailMatch)
    return json(
      scenario.details[decodeURIComponent(detailMatch[1]!)] ?? { code: 'THREAD_NOT_FOUND' },
      scenario.details[decodeURIComponent(detailMatch[1]!)] ? 200 : 404,
    );
  const readMatch = request.pathname.match(/^\/api\/chat\/threads\/([^/]+)\/read-marker$/);
  if (request.method === 'POST' && readMatch)
    return json({
      threadId: decodeURIComponent(readMatch[1]!),
      lastReadMessageId: 'story-read-marker',
      lastReadAt: '2026-08-04T03:00:00.000Z',
    });
  const leaveMatch = request.pathname.match(/^\/api\/chat\/threads\/([^/]+)\/leave$/);
  if (request.method === 'POST' && leaveMatch)
    return json({ threadId: decodeURIComponent(leaveMatch[1]!), archived: true });
  if (request.method === 'POST' && request.pathname === '/api/chat/messages') {
    const first = scenario.list.items[0];
    if (!first) return json({ code: 'THREAD_NOT_FOUND' }, 404);
    return json({
      thread: first,
      message: {
        id: 'story-sent-message',
        senderUserId: 'chat-story-viewer',
        body: 'story message',
        bodyState: 'PLAIN',
        tombstoneReason: null,
        bodyVersion: 1,
        sentAt: '2026-08-04T03:00:00.000Z',
      },
      createdThread: false,
    });
  }
  if (request.method === 'POST' && request.pathname === '/api/reports')
    return json({
      report: {
        id: 'story-report-1',
        targetType: 'CHAT_THREAD',
        reason: 'OTHER',
        receivedAt: '2026-08-04T03:00:00.000Z',
        status: 'RECEIVED',
      },
      received: true,
      optionalActionResult: null,
    });
  return null;
}

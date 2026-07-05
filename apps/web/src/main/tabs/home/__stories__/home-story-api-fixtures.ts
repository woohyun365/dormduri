import { useEffect, useLayoutEffect } from 'react';
import type { GlobalNotice, GlobalNoticePreview } from '@repo/shared/notices';
import type { UserNotification } from '@repo/shared/notifications';
import type { SupportFaqItem, SupportTicketResponse } from '@repo/shared/support';
import {
  createMatchHistoryResponse,
  createPreviousSeasonProfileResponse,
  createPublicProfileFull,
  createSeasonProfileDraftResponse,
} from '@/test/home-profile-detail-fixtures';

export type HomeStoryOperationsMode =
  | 'loaded'
  | 'notices-empty'
  | 'notices-error'
  | 'notifications-empty'
  | 'notifications-error'
  | 'notifications-match-request-received'
  | 'notifications-match-request-accepted'
  | 'notifications-match-request-rejected'
  | 'notifications-active-match-created'
  | 'notifications-support-replied'
  | 'notifications-report-status-updated'
  | 'notifications-season-system-notice'
  | 'notifications-chat-thread-created'
  | 'support-empty'
  | 'support-error';
export type HomeStoryProfileMode = 'default' | 'counterpart-error';

export interface HomeStoryApiFixtureOptions {
  operationsMode?: HomeStoryOperationsMode;
  profileMode?: HomeStoryProfileMode;
}

type StoryFetchStore = {
  originalFetch: typeof fetch;
  refCount: number;
  options: Required<HomeStoryApiFixtureOptions>;
};

const HOME_STORY_FETCH_KEY = '__knuHomeTabStoryFetch__';
const ISO_NOW = '2026-07-03T00:00:00.000Z';
const useStoryFetchEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const defaultFixtureOptions: Required<HomeStoryApiFixtureOptions> = {
  operationsMode: 'loaded',
  profileMode: 'default',
};

export function useHomeStoryApiFixtures(options: HomeStoryApiFixtureOptions = {}) {
  const { operationsMode, profileMode } = options;

  useStoryFetchEffect(() => {
    if (typeof window === 'undefined') return;

    const globalStore = globalThis as typeof globalThis & {
      [HOME_STORY_FETCH_KEY]?: StoryFetchStore;
    };
    const resolvedOptions = resolveFixtureOptions({ operationsMode, profileMode });

    if (globalStore[HOME_STORY_FETCH_KEY]) {
      globalStore[HOME_STORY_FETCH_KEY].refCount += 1;
      globalStore[HOME_STORY_FETCH_KEY].options = resolvedOptions;
      return () => releaseStoryFetchShim(globalStore);
    }

    const originalFetch = window.fetch.bind(window);
    globalStore[HOME_STORY_FETCH_KEY] = {
      originalFetch: window.fetch,
      refCount: 1,
      options: resolvedOptions,
    };

    window.fetch = async (input, init) => {
      const store = globalStore[HOME_STORY_FETCH_KEY];
      const fixtureOptions = store?.options ?? defaultFixtureOptions;
      const request = resolveStoryRequest(input, init);
      const profileResponse = resolveProfileFixtureResponse(request, fixtureOptions.profileMode);
      if (profileResponse) return profileResponse;

      const operationsResponse = resolveOperationsFixtureResponse(
        request,
        fixtureOptions.operationsMode,
      );
      if (operationsResponse) return operationsResponse;

      return originalFetch(input, init);
    };

    return () => releaseStoryFetchShim(globalStore);
  }, [operationsMode, profileMode]);
}

function resolveFixtureOptions(
  options: HomeStoryApiFixtureOptions,
): Required<HomeStoryApiFixtureOptions> {
  return {
    operationsMode: options.operationsMode ?? defaultFixtureOptions.operationsMode,
    profileMode: options.profileMode ?? defaultFixtureOptions.profileMode,
  };
}

function releaseStoryFetchShim(
  globalStore: typeof globalThis & { [HOME_STORY_FETCH_KEY]?: StoryFetchStore },
) {
  const store = globalStore[HOME_STORY_FETCH_KEY];
  if (!store) return;

  store.refCount -= 1;
  if (store.refCount <= 0) {
    window.fetch = store.originalFetch;
    delete globalStore[HOME_STORY_FETCH_KEY];
  }
}

type StoryRequest = {
  method: string;
  pathname: string;
};

function resolveStoryRequest(input: Parameters<typeof fetch>[0], init?: RequestInit): StoryRequest {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  return {
    method: (
      init?.method ?? (typeof input === 'string' || input instanceof URL ? 'GET' : input.method)
    ).toUpperCase(),
    pathname: new URL(rawUrl, window.location.origin).pathname,
  };
}

function resolveProfileFixtureResponse(
  request: StoryRequest,
  profileMode: HomeStoryProfileMode,
): Response | null {
  if (request.method !== 'GET') return null;

  if (request.pathname === '/api/seasons/current/profile') {
    return createStoryJsonResponse(
      createSeasonProfileDraftResponse({
        state: 'REGISTRATION_FINALIZED',
        draftWritable: false,
        intro: '조용한 생활을 선호하고 서로의 생활 리듬을 존중하는 룸메를 찾고 있어요.',
      }),
    );
  }

  if (request.pathname === '/api/seasons/previous/profile') {
    return createStoryJsonResponse(createPreviousSeasonProfileResponse());
  }

  if (request.pathname === '/api/matches/history') {
    return createStoryJsonResponse(createMatchHistoryResponse());
  }

  if (/^\/api\/profiles\/[^/]+$/.test(request.pathname)) {
    if (profileMode === 'counterpart-error') {
      return createStoryJsonResponse({ message: 'counterpart profile unavailable' }, 404);
    }

    return createStoryJsonResponse(
      createPublicProfileFull({
        id: decodeURIComponent(request.pathname.split('/').at(-1) ?? 'partner-user-1'),
        nickname: '민지',
        intro: '아침형 생활패턴이고, 조용한 방 분위기를 선호해요.',
        matchScore: 92,
      }),
    );
  }

  return null;
}

function resolveOperationsFixtureResponse(
  request: StoryRequest,
  operationsMode: HomeStoryOperationsMode,
): Response | null {
  if (
    !request.pathname.startsWith('/api/notices') &&
    !request.pathname.startsWith('/api/notifications') &&
    !request.pathname.startsWith('/api/support')
  ) {
    return null;
  }

  if (request.pathname === '/api/notices' && request.method === 'GET') {
    if (operationsMode === 'notices-error') {
      return createStoryJsonResponse({ message: 'notices unavailable' }, 503);
    }

    return createStoryJsonResponse({
      items: operationsMode === 'notices-empty' ? [] : [createNoticePreview()],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
  }

  if (/^\/api\/notices\/[^/]+$/.test(request.pathname) && request.method === 'GET') {
    if (operationsMode === 'notices-error') {
      return createStoryJsonResponse({ message: 'notice unavailable' }, 503);
    }

    const notice = createNoticeDetail(
      decodeURIComponent(request.pathname.split('/').at(-1) ?? 'notice-1'),
    );
    return createStoryJsonResponse({ notice });
  }

  if (request.pathname === '/api/notifications' && request.method === 'GET') {
    if (operationsMode === 'notifications-error') {
      return createStoryJsonResponse({ message: 'notifications unavailable' }, 503);
    }

    return createStoryJsonResponse({
      items: createNotificationItems(operationsMode),
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
  }

  if (request.pathname === '/api/notifications/unread-count' && request.method === 'GET') {
    if (operationsMode === 'notifications-error') {
      return createStoryJsonResponse({ message: 'notifications unavailable' }, 503);
    }

    return createStoryJsonResponse({
      unreadCount: createNotificationItems(operationsMode).length,
    });
  }

  if (/^\/api\/notifications\/[^/]+\/read$/.test(request.pathname) && request.method === 'POST') {
    const [notification] = createNotificationItems(operationsMode);
    if (!notification) {
      return createStoryJsonResponse({ message: 'notification not found' }, 404);
    }

    return createStoryJsonResponse({
      notification: { ...notification, readAt: ISO_NOW },
    });
  }

  if (request.pathname === '/api/notifications/read-all' && request.method === 'POST') {
    return createStoryJsonResponse({
      updatedCount: createNotificationItems(operationsMode).length,
      readAt: ISO_NOW,
    });
  }

  if (request.pathname === '/api/support/faq' && request.method === 'GET') {
    if (operationsMode === 'support-error') {
      return createStoryJsonResponse({ message: 'support unavailable' }, 503);
    }

    return createStoryJsonResponse({
      items: operationsMode === 'support-empty' ? [] : [createSupportFaq()],
    });
  }

  if (request.pathname === '/api/support/tickets' && request.method === 'GET') {
    if (operationsMode === 'support-error') {
      return createStoryJsonResponse({ message: 'support unavailable' }, 503);
    }

    return createStoryJsonResponse({
      items: operationsMode === 'support-empty' ? [] : [createSupportTicket()],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
  }

  if (
    /^\/api\/support\/tickets\/[^/]+\/messages$/.test(request.pathname) &&
    request.method === 'POST'
  ) {
    if (operationsMode === 'support-error') {
      return createStoryJsonResponse({ message: 'support unavailable' }, 503);
    }

    return createStoryJsonResponse({
      ticket: { ...createSupportTicket(), status: 'WAITING_OPERATOR', lastMessageAt: ISO_NOW },
      message: {
        id: 'story-support-message-user-1',
        ticketId: 'story-support-ticket-1',
        senderType: 'USER',
        createdAt: ISO_NOW,
        body: '추가 확인을 부탁드려요.',
      },
    });
  }

  if (/^\/api\/support\/tickets\/[^/]+$/.test(request.pathname) && request.method === 'GET') {
    if (operationsMode === 'support-error') {
      return createStoryJsonResponse({ message: 'support unavailable' }, 503);
    }

    return createStoryJsonResponse({
      ticket: createSupportTicket(),
      messages: [
        {
          id: 'story-support-message-operator-1',
          ticketId: 'story-support-ticket-1',
          senderType: 'OPERATOR',
          createdAt: ISO_NOW,
          body: '문의 내용을 확인하고 있어요. 필요한 경우 추가 안내를 드릴게요.',
        },
      ],
    });
  }

  return createStoryJsonResponse({ message: 'story fixture not found' }, 404);
}

function createNoticePreview(): GlobalNoticePreview {
  return {
    id: 'story-notice-1',
    title: '2026년 2학기 시즌 운영 안내',
    summary: '운영 일정과 주요 기능 이용 가능 시간을 확인해주세요.',
    severity: 'INFO',
    relatedSeasonId: 'season-2026-02',
    publishedAt: ISO_NOW,
    expiresAt: null,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };
}

function createNoticeDetail(noticeId: string): GlobalNotice {
  return {
    ...createNoticePreview(),
    id: noticeId,
    body: '시즌 참여, 룸메 후보 탐색, 매칭 요청 가능 기간은 운영 일정에 따라 달라져요.\n학교 공식 기숙사 일정과 서비스 안내를 함께 확인해주세요.',
  };
}

function createNotificationItems(operationsMode: HomeStoryOperationsMode): UserNotification[] {
  if (operationsMode === 'notifications-empty') return [];

  return [createNotification(operationsMode)];
}

function createNotification(operationsMode: HomeStoryOperationsMode): UserNotification {
  const base = {
    id: 'story-notification-1',
    recipientUserId: 'story-user-1',
    actorUserId: 'story-actor-1',
    readAt: null,
    createdAt: ISO_NOW,
  } satisfies Pick<
    UserNotification,
    'id' | 'recipientUserId' | 'actorUserId' | 'readAt' | 'createdAt'
  >;

  switch (operationsMode) {
    case 'notifications-match-request-received':
      return {
        ...base,
        kind: 'MATCH_REQUEST_RECEIVED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'story-match-request-received-1',
        payload: {
          kind: 'MATCH_REQUEST_RECEIVED',
          matchRequestId: 'story-match-request-received-1',
          seasonId: 'season-2026-02',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-match-request-accepted':
      return {
        ...base,
        kind: 'MATCH_REQUEST_ACCEPTED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'story-match-request-accepted-1',
        payload: {
          kind: 'MATCH_REQUEST_ACCEPTED',
          matchRequestId: 'story-match-request-accepted-1',
          activeMatchId: 'story-active-match-1',
          seasonId: 'season-2026-02',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-match-request-rejected':
      return {
        ...base,
        kind: 'MATCH_REQUEST_REJECTED',
        sourceType: 'MATCH_REQUEST',
        sourceId: 'story-match-request-rejected-1',
        payload: {
          kind: 'MATCH_REQUEST_REJECTED',
          matchRequestId: 'story-match-request-rejected-1',
          seasonId: 'season-2026-02',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-active-match-created':
      return {
        ...base,
        kind: 'ACTIVE_MATCH_CREATED',
        sourceType: 'ACTIVE_MATCH',
        sourceId: 'story-active-match-1',
        payload: {
          kind: 'ACTIVE_MATCH_CREATED',
          activeMatchId: 'story-active-match-1',
          seasonId: 'season-2026-02',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-report-status-updated':
      return {
        ...base,
        kind: 'REPORT_STATUS_UPDATED',
        sourceType: 'REPORT_CASE',
        sourceId: 'story-report-1',
        payload: {
          kind: 'REPORT_STATUS_UPDATED',
          reportId: 'story-report-1',
          status: 'RESOLVED',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-season-system-notice':
      return {
        ...base,
        kind: 'SEASON_SYSTEM_NOTICE',
        sourceType: 'SEASON',
        sourceId: 'season-2026-02',
        payload: {
          kind: 'SEASON_SYSTEM_NOTICE',
          campaignId: 'story-season-campaign-1',
          seasonId: 'season-2026-02',
          noticeCode: 'SEASON_MATCHING_OPEN',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-chat-thread-created':
      return {
        ...base,
        kind: 'CHAT_THREAD_CREATED',
        sourceType: 'CONVERSATION_THREAD',
        sourceId: 'story-thread-1',
        payload: {
          kind: 'CHAT_THREAD_CREATED',
          threadId: 'story-thread-1',
          actorUserId: 'story-actor-1',
          recipientUserId: 'story-user-1',
          occurredAt: ISO_NOW,
        },
      };
    case 'notifications-support-replied':
    default:
      return {
        ...base,
        actorUserId: 'story-operator-1',
        kind: 'SUPPORT_TICKET_REPLIED',
        sourceType: 'SUPPORT_TICKET',
        sourceId: 'story-support-ticket-1',
        payload: {
          kind: 'SUPPORT_TICKET_REPLIED',
          supportTicketId: 'story-support-ticket-1',
          status: 'WAITING_USER',
          occurredAt: ISO_NOW,
        },
      };
  }
}

function createSupportTicket(): SupportTicketResponse {
  return {
    id: 'story-support-ticket-1',
    category: 'MATCHING',
    subject: '매칭 요청이 보이지 않아요',
    status: 'WAITING_USER',
    relatedEntityId: null,
    appealCategory: null,
    emailReplyConsent: false,
    lastMessageAt: ISO_NOW,
    closedAt: null,
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  };
}

function createSupportFaq(): SupportFaqItem {
  return {
    id: 'story-faq-1',
    category: 'MATCHING',
    question: '매칭 요청은 언제 보낼 수 있나요?',
    answer: '시즌 참여 후 매칭 기간에 같은 기숙사 룸메 후보에게 요청할 수 있어요.',
    published: true,
    sortOrder: 1,
    updatedAt: ISO_NOW,
  };
}

function createStoryJsonResponse(json: unknown, status = 200): Response {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

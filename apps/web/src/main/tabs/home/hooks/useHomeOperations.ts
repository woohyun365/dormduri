'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportFaqItem } from '@repo/shared/support';
import { homeOperationsApi } from '../api/home-operations.api';
import {
  createHomeOperationsViewModel,
  type HomeOperationsViewModel,
} from '../model/operations/homeOperationsViewModel';

type HomeOperationsFeed = 'notice' | 'notification' | 'support';
type HomeOperationsFeedStatus = 'idle' | 'loading' | 'success' | 'error';

type FeedStatusMap = Record<HomeOperationsFeed, HomeOperationsFeedStatus>;
type FeedErrorMap = Partial<Record<HomeOperationsFeed, string>>;

export type HomeOperationsState = Readonly<{
  loading: boolean;
  refreshing: boolean;
  feedStatus: FeedStatusMap;
  errors: FeedErrorMap;
  viewModel: HomeOperationsViewModel;
  unreadCount: number;
  faqs: SupportFaqItem[];
}>;

export type HomeOperationsActions = Readonly<{
  refresh: () => Promise<void>;
}>;

const EMPTY_VIEW_MODEL: HomeOperationsViewModel = {
  globalNotices: [],
  notifications: [],
  supportTickets: [],
};

const IDLE_FEED_STATUS: FeedStatusMap = {
  notice: 'idle',
  notification: 'idle',
  support: 'idle',
};

const LOADING_FEED_STATUS: FeedStatusMap = {
  notice: 'loading',
  notification: 'loading',
  support: 'loading',
};

const SAFE_ERROR_COPY: Record<HomeOperationsFeed, string> = {
  notice: '공지사항을 불러오지 못했어요.',
  notification: '알림함을 불러오지 못했어요.',
  support: '문의 내역을 불러오지 못했어요.',
};

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function resolveFeedStatus<T>(result: PromiseSettledResult<T>): HomeOperationsFeedStatus {
  return isFulfilled(result) ? 'success' : 'error';
}

function resolveFeedError<T>(
  feed: HomeOperationsFeed,
  result: PromiseSettledResult<T>,
): string | undefined {
  return isFulfilled(result) ? undefined : SAFE_ERROR_COPY[feed];
}

export function useHomeOperations(): HomeOperationsState & HomeOperationsActions {
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const [state, setState] = useState<HomeOperationsState>({
    loading: true,
    refreshing: false,
    feedStatus: IDLE_FEED_STATUS,
    errors: {},
    viewModel: EMPTY_VIEW_MODEL,
    unreadCount: 0,
    faqs: [],
  });
  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({
      ...current,
      loading: current.viewModel === EMPTY_VIEW_MODEL,
      refreshing: current.viewModel !== EMPTY_VIEW_MODEL,
      feedStatus: LOADING_FEED_STATUS,
      errors: {},
    }));

    const [noticesResult, notificationsResult, unreadCountResult, ticketsResult, faqsResult] =
      await Promise.allSettled([
        homeOperationsApi.listGlobalNotices({ limit: 3 }),
        homeOperationsApi.listNotifications({ limit: 3 }),
        homeOperationsApi.getNotificationUnreadCount(),
        homeOperationsApi.listSupportTickets({ limit: 3 }),
        homeOperationsApi.listSupportFaq({ surface: 'SUPPORT_CENTER' }),
      ]);

    if (!mountedRef.current || requestIdRef.current !== requestId) return;

    const noticeResponse = isFulfilled(noticesResult) ? noticesResult.value : null;
    const notificationResponse = isFulfilled(notificationsResult)
      ? notificationsResult.value
      : null;
    const supportTicketResponse = isFulfilled(ticketsResult) ? ticketsResult.value : null;

    setState((current) => ({
      ...current,
      loading: false,
      refreshing: false,
      feedStatus: {
        notice: resolveFeedStatus(noticesResult),
        notification: resolveFeedStatus(notificationsResult),
        support: resolveFeedStatus(ticketsResult),
      },
      errors: {
        notice: resolveFeedError('notice', noticesResult),
        notification: resolveFeedError('notification', notificationsResult),
        support: resolveFeedError('support', ticketsResult),
      },
      viewModel: createHomeOperationsViewModel({
        notices: noticeResponse,
        notifications: notificationResponse,
        supportTickets: supportTicketResponse,
      }),
      unreadCount: isFulfilled(unreadCountResult) ? unreadCountResult.value.unreadCount : 0,
      faqs: isFulfilled(faqsResult) ? faqsResult.value.items.slice(0, 2) : [],
    }));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      mountedRef.current = false;
    };
  }, [refresh]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [refresh, state],
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GlobalNotice } from '@repo/shared/notices';
import type { UserNotification } from '@repo/shared/notifications';
import type { SupportFaqItem, SupportTicketDetailResponse } from '@repo/shared/support';
import { homeOperationsApi } from '../api/home-operations.api';
import {
  createHomeOperationsViewModel,
  toHomeNotificationPreview,
  toHomeSupportTicketPreview,
  type HomeNotificationPreview,
  type HomeOperationsViewModel,
  type HomeSupportTicketPreview,
} from '../model/operations/homeOperationsViewModel';

type HomeOperationsFeed = 'notice' | 'notification' | 'support';
type HomeOperationsFeedStatus = 'idle' | 'loading' | 'success' | 'error';

type FeedStatusMap = Record<HomeOperationsFeed, HomeOperationsFeedStatus>;
type FeedErrorMap = Partial<Record<HomeOperationsFeed, string>>;

type NoticeDetailState =
  | { kind: 'notice'; status: 'loading'; noticeId: string }
  | { kind: 'notice'; status: 'success'; notice: GlobalNotice }
  | { kind: 'notice'; status: 'error'; noticeId: string; message: string };

type SupportTicketDetailState =
  | { kind: 'supportTicket'; status: 'loading'; ticketId: string }
  | {
      kind: 'supportTicket';
      status: 'success';
      detail: SupportTicketDetailResponse;
      submittingMessage: boolean;
      messageError: string | null;
    }
  | { kind: 'supportTicket'; status: 'error'; ticketId: string; message: string };

export type HomeOperationsDetailState = NoticeDetailState | SupportTicketDetailState;

export type HomeOperationsState = Readonly<{
  loading: boolean;
  refreshing: boolean;
  feedStatus: FeedStatusMap;
  errors: FeedErrorMap;
  viewModel: HomeOperationsViewModel;
  unreadCount: number;
  faqs: SupportFaqItem[];
  detail: HomeOperationsDetailState | null;
}>;

export type HomeOperationsActions = Readonly<{
  refresh: () => Promise<void>;
  openNoticeDetail: (noticeId: string) => Promise<void>;
  openSupportTicketDetail: (ticketId: string) => Promise<void>;
  closeDetail: () => void;
  markNotificationRead: (notification: HomeNotificationPreview) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  appendSupportTicketMessage: (body: string) => Promise<void>;
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

const DETAIL_ERROR_COPY = '상세 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
const MESSAGE_ERROR_COPY = '메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.';

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

function updateNotificationReadState(
  notifications: HomeNotificationPreview[],
  notification: UserNotification,
): HomeNotificationPreview[] {
  return notifications.map((item) =>
    item.id === notification.id ? toHomeNotificationPreview(notification) : item,
  );
}

function updateSupportTicketPreview(
  tickets: HomeSupportTicketPreview[],
  detail: SupportTicketDetailResponse,
): HomeSupportTicketPreview[] {
  const nextPreview = toHomeSupportTicketPreview(detail.ticket);
  if (tickets.some((ticket) => ticket.id === nextPreview.id)) {
    return tickets.map((ticket) => (ticket.id === nextPreview.id ? nextPreview : ticket));
  }
  return [nextPreview, ...tickets].slice(0, 3);
}

function appendMessageToDetail(
  detail: SupportTicketDetailResponse,
  message: SupportTicketDetailResponse['messages'][number],
): SupportTicketDetailResponse {
  return {
    ticket: detail.ticket,
    messages: [...detail.messages, message],
  };
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
    detail: null,
  });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const openNoticeDetail = useCallback(async (noticeId: string) => {
    setState((current) => ({
      ...current,
      detail: { kind: 'notice', status: 'loading', noticeId },
    }));

    try {
      const response = await homeOperationsApi.getGlobalNotice(noticeId);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        detail: { kind: 'notice', status: 'success', notice: response.notice },
      }));
    } catch {
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        detail: { kind: 'notice', status: 'error', noticeId, message: DETAIL_ERROR_COPY },
      }));
    }
  }, []);

  const openSupportTicketDetail = useCallback(async (ticketId: string) => {
    setState((current) => ({
      ...current,
      detail: { kind: 'supportTicket', status: 'loading', ticketId },
    }));

    try {
      const detail = await homeOperationsApi.getSupportTicket(ticketId);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        detail: {
          kind: 'supportTicket',
          status: 'success',
          detail,
          submittingMessage: false,
          messageError: null,
        },
      }));
    } catch {
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        detail: { kind: 'supportTicket', status: 'error', ticketId, message: DETAIL_ERROR_COPY },
      }));
    }
  }, []);

  const closeDetail = useCallback(() => {
    setState((current) => ({ ...current, detail: null }));
  }, []);

  const markNotificationRead = useCallback(async (notification: HomeNotificationPreview) => {
    if (notification.read) return;
    try {
      const response = await homeOperationsApi.markNotificationRead(notification.id);
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        viewModel: {
          ...current.viewModel,
          notifications: updateNotificationReadState(
            current.viewModel.notifications,
            response.notification,
          ),
        },
      }));
    } catch {
      setState((current) => ({
        ...current,
        errors: { ...current.errors, notification: '알림 읽음 처리를 완료하지 못했어요.' },
      }));
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await homeOperationsApi.markAllNotificationsRead();
      if (!mountedRef.current) return;
      setState((current) => ({
        ...current,
        unreadCount: 0,
        viewModel: {
          ...current.viewModel,
          notifications: current.viewModel.notifications.map((notification) => ({
            ...notification,
            read: true,
          })),
        },
      }));
    } catch {
      setState((current) => ({
        ...current,
        errors: { ...current.errors, notification: '알림 읽음 처리를 완료하지 못했어요.' },
      }));
    }
  }, []);

  const appendSupportTicketMessage = useCallback(async (body: string) => {
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    const currentDetail = stateRef.current.detail;
    if (currentDetail?.kind !== 'supportTicket' || currentDetail.status !== 'success') return;

    const ticketId = currentDetail.detail.ticket.id;
    setState((current) => {
      if (current.detail?.kind !== 'supportTicket' || current.detail.status !== 'success') {
        return current;
      }
      return {
        ...current,
        detail: { ...current.detail, submittingMessage: true, messageError: null },
      };
    });

    try {
      const response = await homeOperationsApi.appendSupportTicketMessage(ticketId, {
        body: trimmedBody,
      });
      if (!mountedRef.current) return;
      setState((current) => {
        if (current.detail?.kind !== 'supportTicket' || current.detail.status !== 'success') {
          return current;
        }
        const detail = {
          ticket: response.ticket,
          messages: appendMessageToDetail(current.detail.detail, response.message).messages,
        };
        return {
          ...current,
          viewModel: {
            ...current.viewModel,
            supportTickets: updateSupportTicketPreview(current.viewModel.supportTickets, detail),
          },
          detail: {
            ...current.detail,
            detail,
            submittingMessage: false,
            messageError: null,
          },
        };
      });
    } catch {
      if (!mountedRef.current) return;
      setState((current) => {
        if (current.detail?.kind !== 'supportTicket' || current.detail.status !== 'success') {
          return current;
        }
        return {
          ...current,
          detail: {
            ...current.detail,
            submittingMessage: false,
            messageError: MESSAGE_ERROR_COPY,
          },
        };
      });
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      refresh,
      openNoticeDetail,
      openSupportTicketDetail,
      closeDetail,
      markNotificationRead,
      markAllNotificationsRead,
      appendSupportTicketMessage,
    }),
    [
      appendSupportTicketMessage,
      closeDetail,
      markAllNotificationsRead,
      markNotificationRead,
      openNoticeDetail,
      openSupportTicketDetail,
      refresh,
      state,
    ],
  );
}

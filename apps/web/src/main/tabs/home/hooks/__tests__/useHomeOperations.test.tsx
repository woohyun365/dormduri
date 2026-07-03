import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeOperationsApi } from '../../api/home-operations.api';
import { useHomeOperations } from '../useHomeOperations';

vi.mock('../../api/home-operations.api', () => ({
  homeOperationsApi: {
    listGlobalNotices: vi.fn(),
    getGlobalNotice: vi.fn(),
    listNotifications: vi.fn(),
    getNotificationUnreadCount: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    listSupportFaq: vi.fn(),
    getSupportFaq: vi.fn(),
    listSupportTickets: vi.fn(),
    getSupportTicket: vi.fn(),
    appendSupportTicketMessage: vi.fn(),
  },
}));

const iso = '2026-07-03T00:00:00.000Z';

const notice = {
  id: 'notice-1',
  title: '운영 안내',
  summary: '서비스 운영 안내입니다.',
  severity: 'WARNING' as const,
  relatedSeasonId: null,
  publishedAt: iso,
  expiresAt: null,
  createdAt: iso,
  updatedAt: iso,
};

const notification = {
  id: 'notification-1',
  recipientUserId: 'user-1',
  actorUserId: 'user-1',
  kind: 'SUPPORT_TICKET_REPLIED' as const,
  sourceType: 'SUPPORT_TICKET' as const,
  sourceId: 'ticket-1',
  payload: {
    kind: 'SUPPORT_TICKET_REPLIED' as const,
    supportTicketId: 'ticket-1',
    status: 'WAITING_USER' as const,
    occurredAt: iso,
  },
  readAt: null,
  createdAt: iso,
};

const ticket = {
  id: 'ticket-1',
  category: 'BUG' as const,
  subject: '버그 문의',
  status: 'WAITING_USER' as const,
  relatedEntityId: null,
  appealCategory: null,
  emailReplyConsent: false,
  lastMessageAt: iso,
  closedAt: null,
  createdAt: iso,
  updatedAt: iso,
};

const faq = {
  id: 'faq-1',
  category: 'BUG' as const,
  question: '오류가 나면 어떻게 하나요?',
  answer: '문의하기를 이용해주세요.',
  published: true,
  sortOrder: 1,
  updatedAt: iso,
};

function setupSuccessApi() {
  vi.mocked(homeOperationsApi.listGlobalNotices).mockResolvedValue({
    items: [notice],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  vi.mocked(homeOperationsApi.listNotifications).mockResolvedValue({
    items: [notification],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  vi.mocked(homeOperationsApi.getNotificationUnreadCount).mockResolvedValue({ unreadCount: 1 });
  vi.mocked(homeOperationsApi.listSupportTickets).mockResolvedValue({
    items: [ticket],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  vi.mocked(homeOperationsApi.listSupportFaq).mockResolvedValue({ items: [faq] });
}

describe('useHomeOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessApi();
  });

  it('공지/알림/문의 feed를 병렬로 불러와 preview view model로 수렴한다', async () => {
    const { result } = renderHook(() => useHomeOperations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.viewModel.globalNotices).toEqual([
      expect.objectContaining({ id: 'notice-1', title: '운영 안내' }),
    ]);
    expect(result.current.viewModel.notifications).toEqual([
      expect.objectContaining({ id: 'notification-1', supportTicketId: 'ticket-1', read: false }),
    ]);
    expect(result.current.viewModel.supportTickets).toEqual([
      expect.objectContaining({ id: 'ticket-1', subject: '버그 문의' }),
    ]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.faqs).toEqual([faq]);
  });

  it('부분 실패는 실패 feed만 error로 두고 성공 feed는 유지한다', async () => {
    vi.mocked(homeOperationsApi.listNotifications).mockRejectedValue(
      new Error('notification down'),
    );

    const { result } = renderHook(() => useHomeOperations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.feedStatus.notice).toBe('success');
    expect(result.current.feedStatus.notification).toBe('error');
    expect(result.current.feedStatus.support).toBe('success');
    expect(result.current.viewModel.globalNotices).toHaveLength(1);
    expect(result.current.viewModel.notifications).toEqual([]);
    expect(result.current.errors.notification).toBe('알림함을 불러오지 못했어요.');
  });

  it('공지와 문의 상세는 preview와 분리해서 lazy fetch한다', async () => {
    vi.mocked(homeOperationsApi.getGlobalNotice).mockResolvedValue({
      notice: { ...notice, body: '공지 상세 본문입니다.' },
    });
    vi.mocked(homeOperationsApi.getSupportTicket).mockResolvedValue({
      ticket,
      messages: [
        {
          id: 'message-1',
          ticketId: 'ticket-1',
          senderType: 'OPERATOR',
          createdAt: iso,
          body: '확인 중입니다.',
        },
      ],
    });

    const { result } = renderHook(() => useHomeOperations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.openNoticeDetail('notice-1');
    });
    expect(result.current.detail).toEqual(
      expect.objectContaining({ kind: 'notice', status: 'success' }),
    );

    await act(async () => {
      await result.current.openSupportTicketDetail('ticket-1');
    });
    expect(result.current.detail).toEqual(
      expect.objectContaining({ kind: 'supportTicket', status: 'success' }),
    );
  });

  it('알림 읽음 처리와 support follow-up message를 local state에 반영한다', async () => {
    vi.mocked(homeOperationsApi.markNotificationRead).mockResolvedValue({
      notification: { ...notification, readAt: iso },
    });
    vi.mocked(homeOperationsApi.getSupportTicket).mockResolvedValue({
      ticket,
      messages: [],
    });
    vi.mocked(homeOperationsApi.appendSupportTicketMessage).mockResolvedValue({
      ticket: { ...ticket, status: 'WAITING_OPERATOR', lastMessageAt: iso },
      message: {
        id: 'message-2',
        ticketId: 'ticket-1',
        senderType: 'USER',
        createdAt: iso,
        body: '추가 정보입니다.',
      },
    });

    const { result } = renderHook(() => useHomeOperations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markNotificationRead(result.current.viewModel.notifications[0]!);
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.viewModel.notifications[0]?.read).toBe(true);

    await act(async () => {
      await result.current.openSupportTicketDetail('ticket-1');
    });
    await act(async () => {
      await result.current.appendSupportTicketMessage('추가 정보입니다.');
    });

    expect(result.current.detail).toEqual(
      expect.objectContaining({
        kind: 'supportTicket',
        status: 'success',
        detail: expect.objectContaining({
          messages: [expect.objectContaining({ body: '추가 정보입니다.' })],
        }),
      }),
    );
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsPageClient from '../NotificationsPageClient';
import { notificationsPageApi } from '../api/notifications-page.api';

vi.mock('../api/notifications-page.api', () => ({
  notificationsPageApi: {
    listNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const iso = '2026-07-03T00:00:00.000Z';
const notification = {
  id: 'notification-1',
  recipientUserId: 'user-1',
  actorUserId: 'system',
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

describe('NotificationsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationsPageApi.listNotifications).mockResolvedValue({
      items: [notification],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(notificationsPageApi.getUnreadCount).mockResolvedValue({ unreadCount: 1 });
    vi.mocked(notificationsPageApi.markRead).mockResolvedValue({
      notification: { ...notification, readAt: iso },
    });
    vi.mocked(notificationsPageApi.markAllRead).mockResolvedValue({ updatedCount: 1, readAt: iso });
  });

  it('pointer-only 알림 목록과 unread count를 표시한다', async () => {
    render(<NotificationsPageClient />);

    expect(await screen.findByText('문의 답변이 도착했어요')).toBeInTheDocument();
    expect(screen.getByText('읽지 않은 알림 1개')).toBeInTheDocument();
    expect(
      screen.getByText('답변 본문은 문의 내역에서 다시 권한 확인 후 보여드려요.'),
    ).toBeInTheDocument();
  });

  it('모두 읽음 action 후 unread count를 0으로 갱신한다', async () => {
    const user = userEvent.setup();
    render(<NotificationsPageClient />);

    await user.click(await screen.findByRole('button', { name: /모두 읽음/ }));

    await waitFor(() => expect(notificationsPageApi.markAllRead).toHaveBeenCalled());
    expect(screen.getByText('읽지 않은 알림 0개')).toBeInTheDocument();
  });
});

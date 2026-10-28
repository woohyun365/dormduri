import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandName } from '@/screens/ui/brand';
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

  it('header 로고는 서비스 이름 하나로 읽히고 /main으로 간다', async () => {
    render(<NotificationsPageClient />);

    const home = screen.getByRole('link', { name: brandName });
    expect(home).toHaveAttribute('href', '/main');
    expect(within(home).getAllByRole('img')).toHaveLength(1);
    await waitFor(() => expect(notificationsPageApi.listNotifications).toHaveBeenCalled());
  });

  it('알림 목록과 unread count를 사용자 문구로 표시한다', async () => {
    render(<NotificationsPageClient />);

    expect(await screen.findByText('문의 답변이 도착했어요')).toBeInTheDocument();
    expect(screen.getByText('읽지 않은 알림 1개')).toBeInTheDocument();
    expect(screen.getByText('문의 답변은 문의 내역에서 확인할 수 있어요.')).toBeInTheDocument();
  });

  it('모두 읽음 action 후 unread count를 0으로 갱신한다', async () => {
    const user = userEvent.setup();
    render(<NotificationsPageClient />);

    await user.click(await screen.findByRole('button', { name: /모두 읽음/ }));

    await waitFor(() => expect(notificationsPageApi.markAllRead).toHaveBeenCalled());
    expect(screen.getByText('읽지 않은 알림 0개')).toBeInTheDocument();
  });
});

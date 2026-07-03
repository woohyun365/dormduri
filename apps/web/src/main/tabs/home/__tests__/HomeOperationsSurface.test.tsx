import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeOperationsSurface } from '../sections/operations/HomeOperationsSurface';
import { useHomeOperations } from '../hooks/useHomeOperations';
import type { HomeOperationsState } from '../hooks/useHomeOperations';

vi.mock('../hooks/useHomeOperations', () => ({
  useHomeOperations: vi.fn(),
}));

const iso = '2026-07-03T00:00:00.000Z';

const actions = {
  refresh: vi.fn(async () => undefined),
  openNoticeDetail: vi.fn(async () => undefined),
  openSupportTicketDetail: vi.fn(async () => undefined),
  closeDetail: vi.fn(),
  markNotificationRead: vi.fn(async () => undefined),
  markAllNotificationsRead: vi.fn(async () => undefined),
  appendSupportTicketMessage: vi.fn(async () => undefined),
};

const baseState: HomeOperationsState = {
  loading: false,
  refreshing: false,
  feedStatus: {
    notice: 'success',
    notification: 'success',
    support: 'success',
  },
  errors: {},
  unreadCount: 1,
  faqs: [
    {
      id: 'faq-1',
      category: 'BUG',
      question: '오류가 나면 어떻게 하나요?',
      answer: '문의하기를 이용해주세요.',
      published: true,
      sortOrder: 1,
      updatedAt: iso,
    },
  ],
  viewModel: {
    globalNotices: [
      {
        id: 'notice-1',
        title: '운영 안내',
        summary: '서비스 운영 안내입니다.',
        severity: 'WARNING',
        publishedAt: iso,
        relatedSeasonId: null,
      },
    ],
    notifications: [
      {
        id: 'notification-1',
        kind: 'SUPPORT_TICKET_REPLIED',
        sourceType: 'SUPPORT_TICKET',
        sourceId: 'ticket-1',
        read: false,
        createdAt: iso,
        title: '문의 답변이 도착했어요',
        supportTicketId: 'ticket-1',
      },
    ],
    supportTickets: [
      {
        id: 'ticket-1',
        category: 'BUG',
        status: 'WAITING_USER',
        subject: '버그 문의',
        lastMessageAt: iso,
      },
    ],
  },
  detail: null,
};

function mockOperations(overrides: Partial<HomeOperationsState> = {}) {
  vi.mocked(useHomeOperations).mockReturnValue({
    ...baseState,
    ...overrides,
    viewModel: overrides.viewModel ?? baseState.viewModel,
    feedStatus: overrides.feedStatus ?? baseState.feedStatus,
    errors: overrides.errors ?? baseState.errors,
    ...actions,
  });
}

describe('HomeOperationsSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOperations();
  });

  it('공지사항 배너와 알림함·문의하기 surface를 분리해서 렌더링한다', () => {
    render(<HomeOperationsSurface />);

    expect(screen.getByRole('region', { name: '공지사항' })).toBeInTheDocument();
    expect(screen.getByLabelText('알림함과 문의하기')).toBeInTheDocument();
    expect(screen.getByText('운영 안내')).toBeInTheDocument();
    expect(screen.getByText('문의 답변이 도착했어요')).toBeInTheDocument();
    expect(screen.getByText('읽지 않은 알림 1개')).toBeInTheDocument();
    expect(screen.getByText('오류가 나면 어떻게 하나요?')).toBeInTheDocument();
    expect(screen.getByText('버그 문의')).toBeInTheDocument();
  });

  it('공지와 문의 preview 클릭 시 detail action을 호출한다', async () => {
    const user = userEvent.setup();
    render(<HomeOperationsSurface />);

    await user.click(screen.getByRole('button', { name: /운영 안내/ }));
    expect(actions.openNoticeDetail).toHaveBeenCalledWith('notice-1');

    await user.click(screen.getByRole('button', { name: /버그 문의/ }));
    expect(actions.openSupportTicketDetail).toHaveBeenCalledWith('ticket-1');
  });

  it('partial error는 공지사항 배너를 유지하고 feed-local retry surface로 표시한다', async () => {
    const user = userEvent.setup();
    mockOperations({
      feedStatus: { notice: 'success', notification: 'error', support: 'success' },
      errors: { notification: '알림함을 불러오지 못했어요.' },
      viewModel: { ...baseState.viewModel, notifications: [] },
    });

    render(<HomeOperationsSurface />);

    expect(screen.getByText('운영 안내')).toBeInTheDocument();
    expect(screen.getByText('알림함을 불러오지 못했어요.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(actions.refresh).toHaveBeenCalled();
  });

  it('support ticket detail sheet에서 message timeline과 follow-up composer를 제공한다', async () => {
    const user = userEvent.setup();
    mockOperations({
      detail: {
        kind: 'supportTicket',
        status: 'success',
        submittingMessage: false,
        messageError: null,
        detail: {
          ticket: {
            id: 'ticket-1',
            category: 'BUG',
            subject: '버그 문의',
            status: 'WAITING_USER',
            relatedEntityId: null,
            appealCategory: null,
            emailReplyConsent: false,
            lastMessageAt: iso,
            closedAt: null,
            createdAt: iso,
            updatedAt: iso,
          },
          messages: [
            {
              id: 'message-1',
              ticketId: 'ticket-1',
              senderType: 'OPERATOR',
              createdAt: iso,
              body: '확인 중입니다.',
            },
          ],
        },
      },
    });

    render(<HomeOperationsSurface />);

    const dialog = screen.getByRole('dialog', { name: '문의 내역' });
    expect(within(dialog).getByText('확인 중입니다.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('추가 메시지'), '추가 정보입니다.');
    await user.click(within(dialog).getByRole('button', { name: /추가 메시지/ }));

    expect(actions.appendSupportTicketMessage).toHaveBeenCalledWith('추가 정보입니다.');
  });
});

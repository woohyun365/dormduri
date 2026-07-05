import { render, screen } from '@testing-library/react';
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

  it('공지와 문의 preview는 dedicated page link로 연결한다', () => {
    render(<HomeOperationsSurface />);

    expect(screen.getByRole('link', { name: /운영 안내/ })).toHaveAttribute(
      'href',
      '/notices/notice-1',
    );
    expect(screen.getByRole('link', { name: /버그 문의/ })).toHaveAttribute(
      'href',
      '/support?ticketId=ticket-1',
    );
    expect(
      screen
        .getAllByRole('link', { name: /문의하기/ })
        .some((link) => link.getAttribute('href') === '/support'),
    ).toBe(true);
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
});

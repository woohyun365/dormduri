import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupportPageClient from '../SupportPageClient';
import { supportPageApi } from '../api/support-page.api';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('ticketId=ticket-1'),
}));

vi.mock('../api/support-page.api', () => ({
  supportPageApi: {
    listFaq: vi.fn(),
    listTickets: vi.fn(),
    getTicket: vi.fn(),
    createTicket: vi.fn(),
    appendMessage: vi.fn(),
  },
}));

const iso = '2026-07-03T00:00:00.000Z';
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

describe('SupportPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supportPageApi.listFaq).mockResolvedValue({
      items: [
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
    });
    vi.mocked(supportPageApi.listTickets).mockResolvedValue({
      items: [ticket],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(supportPageApi.getTicket).mockResolvedValue({
      ticket,
      messages: [
        {
          id: 'message-1',
          ticketId: 'ticket-1',
          senderType: 'OPERATOR',
          body: '확인 중입니다.',
          createdAt: iso,
        },
      ],
    });
    vi.mocked(supportPageApi.createTicket).mockResolvedValue({
      ticket: { ...ticket, id: 'ticket-2', subject: '새 문의' },
    });
    vi.mocked(supportPageApi.appendMessage).mockResolvedValue({
      ticket: { ...ticket, status: 'WAITING_OPERATOR' },
      message: {
        id: 'message-2',
        ticketId: 'ticket-1',
        senderType: 'USER',
        body: '추가 정보입니다.',
        createdAt: iso,
      },
    });
  });

  it('FAQ, 내 문의 목록, 선택된 문의 thread를 표시한다', async () => {
    render(<SupportPageClient />);

    expect(await screen.findByText('오류가 나면 어떻게 하나요?')).toBeInTheDocument();
    expect(screen.getAllByText('버그 문의').length).toBeGreaterThan(0);
    expect(await screen.findByText('확인 중입니다.')).toBeInTheDocument();
  });

  it('추가 메시지를 ticket detail에 append한다', async () => {
    const user = userEvent.setup();
    render(<SupportPageClient />);

    const thread = await screen.findByRole('region', { name: '문의 메시지' });
    expect(within(thread).getByText('확인 중입니다.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('추가 메시지'), '추가 정보입니다.');
    await user.click(screen.getByRole('button', { name: /메시지 보내기/ }));

    await waitFor(() => {
      expect(supportPageApi.appendMessage).toHaveBeenCalledWith('ticket-1', {
        body: '추가 정보입니다.',
      });
    });
  });
});

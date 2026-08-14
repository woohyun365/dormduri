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
    listReports: vi.fn(),
    listEnforcements: vi.fn(),
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

const report = {
  id: 'report-1',
  targetType: 'PROFILE' as const,
  targetLabel: '감자친구님',
  reason: 'FALSE_PROFILE' as const,
  receivedAt: iso,
  status: 'RECEIVED' as const,
};

const enforcementNotice = {
  id: 'season-participant:participant-1',
  actionType: 'MATCHING_RESTRICTION' as const,
  reasonCategory: 'POLICY_VIOLATION' as const,
  status: 'ACTIVE' as const,
  seasonLabel: '2026년 2학기',
  scopeLabel: '2026년 2학기 · 다산관 룸메 탐색/매칭',
  policyBasisSummary: '신고 또는 운영 검토에서 서비스 이용 기준 위반이 확인된 경우 적용돼요.',
  effectiveFrom: iso,
  effectiveUntil: '2026-08-31T00:00:00.000Z',
  createdAt: iso,
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
        },
      ],
    });
    vi.mocked(supportPageApi.listTickets).mockResolvedValue({
      items: [ticket],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(supportPageApi.listReports).mockResolvedValue({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(supportPageApi.listEnforcements).mockResolvedValue({
      items: [],
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

  it('내 신고 내역에서 REPORT_RESULT 이의 신청 form을 열고 relatedEntityId를 전송한다', async () => {
    const user = userEvent.setup();
    vi.mocked(supportPageApi.listReports).mockResolvedValueOnce({
      items: [report],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    render(<SupportPageClient />);

    expect(await screen.findByText('내 신고 내역')).toBeInTheDocument();
    expect(screen.getByText('감자친구님')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '신고 처리 이의 신청' }));
    expect(screen.getByDisplayValue('신고 처리 이의 신청')).toBeInTheDocument();
    expect(screen.getByText(/신고 내역과 연결된 이의 신청/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /문의 접수하기/ }));

    await waitFor(() => {
      expect(supportPageApi.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'APPEAL',
          appealCategory: 'REPORT_RESULT',
          relatedEntityId: 'report-1',
          subject: '신고 처리 이의 신청',
        }),
      );
    });
  });

  it('신고 처리 이의 ticket이 이미 있으면 운영자 대화로 이동한다', async () => {
    const user = userEvent.setup();
    const reportTicket = {
      ...ticket,
      id: 'ticket-report-1',
      category: 'APPEAL' as const,
      subject: '신고 처리 이의 신청',
      appealCategory: 'REPORT_RESULT' as const,
      relatedEntityId: 'report-1',
    };
    vi.mocked(supportPageApi.listTickets).mockResolvedValueOnce({
      items: [reportTicket],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(supportPageApi.listReports).mockResolvedValueOnce({
      items: [report],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    render(<SupportPageClient />);

    await user.click(await screen.findByRole('button', { name: '운영자 대화 보기' }));

    await waitFor(() => expect(supportPageApi.getTicket).toHaveBeenCalledWith('ticket-report-1'));
  });

  it('내 이용 제한 내역에서 SANCTION/TEMPORARY_RESTRICTION 이의 신청 form을 연다', async () => {
    const user = userEvent.setup();
    vi.mocked(supportPageApi.listEnforcements).mockResolvedValueOnce({
      items: [enforcementNotice],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    render(<SupportPageClient />);

    expect(await screen.findByText('내 이용 제한 내역')).toBeInTheDocument();
    expect(screen.getByText('매칭 제한')).toBeInTheDocument();
    expect(screen.getByText(/위반 사유: 정책 위반/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '이의 신청하기' }));
    expect(screen.getByDisplayValue('이용 제한 이의 신청')).toBeInTheDocument();
    expect(screen.getByText(/이용 제한 내역과 연결된 이의 신청/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /문의 접수하기/ }));

    await waitFor(() => {
      expect(supportPageApi.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'APPEAL',
          appealCategory: 'TEMPORARY_RESTRICTION',
          relatedEntityId: 'season-participant:participant-1',
          subject: '이용 제한 이의 신청',
        }),
      );
    });
  });

  it('이용 제한 이의 ticket이 이미 있으면 운영자 대화로 이동한다', async () => {
    const user = userEvent.setup();
    const enforcementTicket = {
      ...ticket,
      id: 'ticket-enforcement-1',
      category: 'APPEAL' as const,
      subject: '이용 제한 이의 신청',
      appealCategory: 'TEMPORARY_RESTRICTION' as const,
      relatedEntityId: 'season-participant:participant-1',
    };
    vi.mocked(supportPageApi.listTickets).mockResolvedValueOnce({
      items: [enforcementTicket],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    vi.mocked(supportPageApi.listEnforcements).mockResolvedValueOnce({
      items: [enforcementNotice],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });
    render(<SupportPageClient />);

    await user.click(await screen.findByRole('button', { name: '운영자 대화 보기' }));

    await waitFor(() =>
      expect(supportPageApi.getTicket).toHaveBeenCalledWith('ticket-enforcement-1'),
    );
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

import { describe, expect, it } from 'vitest';
import {
  createHomeOperationsViewModel,
  toHomeNotificationPreview,
} from '../homeOperationsViewModel';

const iso = '2026-07-03T00:00:00.000Z';

const noticePreview = {
  id: 'notice-1',
  title: '운영 안내',
  summary: '서비스 운영 안내입니다.',
  severity: 'INFO' as const,
  relatedSeasonId: null,
  publishedAt: iso,
  expiresAt: null,
  createdAt: iso,
  updatedAt: iso,
};

const ticket = {
  id: 'ticket-1',
  category: 'BUG' as const,
  subject: '버그 문의',
  status: 'OPEN' as const,
  relatedEntityId: null,
  appealCategory: null,
  emailReplyConsent: false,
  lastMessageAt: iso,
  closedAt: null,
  createdAt: iso,
  updatedAt: iso,
};

describe('home operations view model', () => {
  it('global notice preview는 detail body를 만들지 않는다', () => {
    const viewModel = createHomeOperationsViewModel({
      notices: { items: [noticePreview], pageInfo: { hasNextPage: false, nextCursor: null } },
    });

    expect(viewModel.globalNotices).toEqual([
      {
        id: 'notice-1',
        title: '운영 안내',
        summary: '서비스 운영 안내입니다.',
        severity: 'INFO',
        publishedAt: iso,
        relatedSeasonId: null,
      },
    ]);
    expect(viewModel.globalNotices[0]).not.toHaveProperty('body');
  });

  it('support notification은 ticket id pointer만 노출하고 support body를 만들지 않는다', () => {
    const preview = toHomeNotificationPreview({
      id: 'notification-1',
      recipientUserId: 'user-1',
      actorUserId: 'user-1',
      kind: 'SUPPORT_TICKET_REPLIED',
      sourceType: 'SUPPORT_TICKET',
      sourceId: 'ticket-1',
      payload: {
        kind: 'SUPPORT_TICKET_REPLIED',
        supportTicketId: 'ticket-1',
        status: 'WAITING_USER',
        occurredAt: iso,
      },
      readAt: null,
      createdAt: iso,
    });

    expect(preview).toEqual({
      id: 'notification-1',
      kind: 'SUPPORT_TICKET_REPLIED',
      sourceType: 'SUPPORT_TICKET',
      sourceId: 'ticket-1',
      supportTicketId: 'ticket-1',
      read: false,
      createdAt: iso,
      title: '문의 답변이 도착했어요',
    });
    expect(preview).not.toHaveProperty('body');
  });

  it('support ticket preview는 message timeline을 preview에 섞지 않는다', () => {
    const viewModel = createHomeOperationsViewModel({
      supportTickets: {
        items: [ticket],
        pageInfo: { hasNextPage: false, nextCursor: null },
      },
    });

    expect(viewModel.supportTickets).toEqual([
      {
        id: 'ticket-1',
        category: 'BUG',
        status: 'OPEN',
        subject: '버그 문의',
        lastMessageAt: iso,
      },
    ]);
    expect(viewModel.supportTickets[0]).not.toHaveProperty('messages');
  });
});

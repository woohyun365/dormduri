import {
  toSupportTicketDetailResponse,
  toSupportTicketListResponse,
} from './support-ticket.presenter.js';
import type {
  SupportTicketMessageRecord,
  SupportTicketRecord,
} from '../repositories/support-ticket.repository.js';

function ticket(id: string, lastMessageAt: Date): SupportTicketRecord {
  return {
    id,
    requesterUserId: 'user-1',
    category: 'BUG',
    subject: '버그 문의',
    status: 'OPEN',
    relatedEntityId: null,
    appealCategory: null,
    emailReplyConsent: false,
    lastMessageAt,
    closedAt: null,
    createdAt: lastMessageAt,
    updatedAt: lastMessageAt,
  };
}

describe('support ticket presenter', () => {
  it('list response는 cursor와 allowlist ticket summary만 반환한다', () => {
    const response = toSupportTicketListResponse({
      records: [
        ticket('ticket-1', new Date('2026-06-08T00:00:00.000Z')),
        ticket('ticket-2', new Date('2026-06-07T00:00:00.000Z')),
      ],
      limit: 1,
    });

    expect(response.items).toHaveLength(1);
    expect(response.pageInfo.hasNextPage).toBe(true);
    expect(response.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(response.items[0]).not.toHaveProperty('requesterUserId');
  });

  it('detail response만 message body를 포함하고 ticket root에는 email/raw payload를 포함하지 않는다', () => {
    const message: SupportTicketMessageRecord = {
      id: 'message-1',
      ticketId: 'ticket-1',
      senderType: 'USER',
      senderUserId: 'user-1',
      body: '문의 본문',
      createdAt: new Date('2026-06-08T00:00:00.000Z'),
    };

    const response = toSupportTicketDetailResponse({
      ticket: ticket('ticket-1', new Date('2026-06-08T00:00:00.000Z')),
      messages: [message],
    });

    expect(response.messages[0]?.body).toBe('문의 본문');
    expect(response.ticket).not.toHaveProperty('email');
    expect(response.ticket).not.toHaveProperty('body');
  });
});

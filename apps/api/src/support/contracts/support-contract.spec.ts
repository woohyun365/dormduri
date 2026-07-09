import { describe, expect, it } from 'vitest';
import {
  appendSupportTicketMessageRequestSchema,
  createSupportTicketRequestSchema,
  SupportFaqSurface,
  listSupportFaqQuerySchema,
  listSupportTicketsQuerySchema,
  replySupportTicketRequestSchema,
  resolveSupportTicketRequestSchema,
  supportFaqDetailResponseSchema,
  supportFaqListResponseSchema,
  supportTicketDetailResponseSchema,
  supportTicketListResponseSchema,
} from '@repo/shared/support';

describe('support shared/API contract', () => {
  it('APPEAL ticket은 appealCategory를 필수로 요구하고 일반 문의는 optional로 둔다', () => {
    expect(
      createSupportTicketRequestSchema.safeParse({
        category: 'APPEAL',
        subject: '소명 요청',
        body: '소명을 요청합니다.',
        emailReplyConsent: true,
      }).success,
    ).toBe(false);

    expect(
      createSupportTicketRequestSchema.safeParse({
        category: 'APPEAL',
        appealCategory: 'REPORT_RESULT',
        subject: '신고 처리 이의 신청',
        body: '재검토를 요청합니다.',
      }).success,
    ).toBe(false);

    expect(
      createSupportTicketRequestSchema.parse({
        category: 'APPEAL',
        appealCategory: 'REPORT_RESULT',
        relatedEntityId: 'report-1',
        subject: '소명 요청',
        body: '소명을 요청합니다.',
      }),
    ).toMatchObject({
      category: 'APPEAL',
      appealCategory: 'REPORT_RESULT',
      relatedEntityId: 'report-1',
      emailReplyConsent: false,
    });

    expect(
      createSupportTicketRequestSchema.parse({
        category: 'ACCOUNT',
        subject: '계정 문의',
        body: '확인해주세요.',
      }),
    ).toMatchObject({ category: 'ACCOUNT', emailReplyConsent: false });
  });

  it('ticket message/reply/resolve/list/FAQ request schema를 고정한다', () => {
    expect(appendSupportTicketMessageRequestSchema.parse({ body: '추가 문의' })).toEqual({
      body: '추가 문의',
    });
    expect(replySupportTicketRequestSchema.parse({ body: '답변' })).toEqual({
      body: '답변',
      status: 'WAITING_USER',
    });
    expect(resolveSupportTicketRequestSchema.parse({})).toEqual({ status: 'RESOLVED' });
    expect(
      listSupportTicketsQuerySchema.parse({ status: 'OPEN', category: 'BUG', limit: '10' }),
    ).toEqual({ status: 'OPEN', category: 'BUG', limit: 10 });
    expect(listSupportFaqQuerySchema.parse({ category: 'OTHER' })).toEqual({ category: 'OTHER' });
    expect(listSupportFaqQuerySchema.parse({ surface: SupportFaqSurface.LANDING })).toEqual({
      surface: 'LANDING',
    });
    expect(
      listSupportFaqQuerySchema.parse({ category: 'OTHER', surface: 'SUPPORT_CENTER' }),
    ).toEqual({
      category: 'OTHER',
      surface: 'SUPPORT_CENTER',
    });
    expect(listSupportFaqQuerySchema.safeParse({ surface: 'HOME' }).success).toBe(false);
  });

  it('list/detail/FAQ response는 ticket pointer와 공개 필드만 허용한다', () => {
    const ticket = {
      id: 'ticket-1',
      category: 'BUG',
      subject: '버그 문의',
      status: 'OPEN',
      relatedEntityId: null,
      appealCategory: null,
      emailReplyConsent: false,
      lastMessageAt: '2026-06-08T00:00:00.000Z',
      closedAt: null,
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    };
    const message = {
      id: 'message-1',
      ticketId: 'ticket-1',
      senderType: 'USER',
      body: '문의 본문',
      createdAt: '2026-06-08T00:00:00.000Z',
    };

    expect(
      supportTicketListResponseSchema.parse({
        items: [ticket],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    ).toEqual({ items: [ticket], pageInfo: { hasNextPage: false, nextCursor: null } });
    expect(supportTicketDetailResponseSchema.parse({ ticket, messages: [message] })).toEqual({
      ticket,
      messages: [message],
    });

    const faq = {
      id: 'faq-1',
      category: 'OTHER',
      question: '질문',
      answer: '답변',
      published: true,
      sortOrder: 1,
      updatedAt: '2026-06-08T00:00:00.000Z',
    };
    expect(supportFaqListResponseSchema.parse({ items: [faq] })).toEqual({ items: [faq] });
    expect(supportFaqDetailResponseSchema.parse({ item: faq })).toEqual({ item: faq });
  });

  it('response schema는 unknown raw support/email payload key를 거절한다', () => {
    const ticket = {
      id: 'ticket-1',
      category: 'BUG',
      subject: '버그 문의',
      status: 'OPEN',
      relatedEntityId: null,
      appealCategory: null,
      emailReplyConsent: false,
      lastMessageAt: '2026-06-08T00:00:00.000Z',
      closedAt: null,
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
      email: 'user@example.com',
    };

    expect(
      supportTicketListResponseSchema.safeParse({
        items: [ticket],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }).success,
    ).toBe(false);
  });
});

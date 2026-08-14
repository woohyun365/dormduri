import { describe, expect, it, vi, type Mocked } from 'vitest';

vi.mock('../../generated/prisma/sql.js', () => ({
  getCurrentTimestamp: vi.fn(() => ({})),
}));

import { CreateSupportTicketCommand } from './create-support-ticket.command.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SupportNotificationService } from '../notifications/support-notification.service.js';
import type {
  SupportTicketMessageRecord,
  SupportTicketRecord,
  SupportTicketRepository,
} from '../repositories/support-ticket.repository.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const ticket = {
  id: 'ticket-1',
  requesterUserId: 'user-1',
  category: 'BUG',
  subject: '버그 문의',
  status: 'OPEN',
  relatedEntityId: null,
  appealCategory: null,
  emailReplyConsent: true,
  lastMessageAt: now,
  closedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies SupportTicketRecord;
const message = {
  id: 'message-1',
  ticketId: 'ticket-1',
  senderType: 'USER',
  senderUserId: 'user-1',
  body: '문의 본문',
  createdAt: now,
} satisfies SupportTicketMessageRecord;

function setup() {
  const tx = {} as never;
  const runSerializableTransaction = vi.fn((operation: (txArg: typeof tx) => unknown) =>
    Promise.resolve(operation(tx)),
  );
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    runSerializableTransaction,
  } as unknown as PrismaService;
  const createTicketWithMessage = vi.fn().mockResolvedValue({ ticket, message });
  const findOwnedReportCase = vi.fn().mockResolvedValue({ id: 'report-1' });
  const findOwnedEnforcementNotice = vi.fn().mockResolvedValue({ id: 'participant-1' });
  const repository = {
    createTicketWithMessage,
    findOwnedReportCase,
    findOwnedEnforcementNotice,
  } as unknown as Mocked<SupportTicketRepository>;
  const appendTicketCreated = vi.fn().mockResolvedValue({ notificationId: 'n-1', created: true });
  const notificationService = {
    appendTicketCreated,
  } as unknown as Mocked<SupportNotificationService>;
  const command = new CreateSupportTicketCommand(prisma, repository, notificationService);

  return {
    command,
    createTicketWithMessage,
    appendTicketCreated,
    runSerializableTransaction,
    tx,
    findOwnedReportCase,
    findOwnedEnforcementNotice,
  };
}

describe('CreateSupportTicketCommand', () => {
  it('ticket/message 생성과 support notification append를 같은 transaction에 요청한다', async () => {
    const { command, createTicketWithMessage, appendTicketCreated, tx } = setup();

    const response = await command.execute({
      authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
      request: {
        category: 'BUG',
        subject: '버그 문의',
        body: '문의 본문',
        emailReplyConsent: true,
      },
    });

    expect(createTicketWithMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        requesterUserId: 'user-1',
        category: 'BUG',
        subject: '버그 문의',
        body: '문의 본문',
        relatedEntityId: undefined,
        appealCategory: undefined,
        emailReplyConsent: true,
        now,
      }),
    );
    expect(appendTicketCreated).toHaveBeenCalledWith({
      tx,
      requesterUserId: 'user-1',
      supportTicketId: 'ticket-1',
      category: 'BUG',
      occurredAt: now,
    });
    expect(response).toMatchObject({ ticket: { id: 'ticket-1', status: 'OPEN' } });
  });

  it('REPORT_RESULT 이의 신청은 본인 신고 내역과 연결된 경우에만 ticket을 생성한다', async () => {
    const { command, createTicketWithMessage, findOwnedReportCase, tx } = setup();

    await command.execute({
      authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
      request: {
        category: 'APPEAL',
        appealCategory: 'REPORT_RESULT',
        relatedEntityId: 'report-1',
        subject: '신고 처리 이의 신청',
        body: '재검토를 요청합니다.',
        emailReplyConsent: false,
      },
    });

    expect(findOwnedReportCase).toHaveBeenCalledWith({
      client: tx,
      reportCaseId: 'report-1',
      requesterUserId: 'user-1',
    });
    expect(createTicketWithMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'APPEAL',
        appealCategory: 'REPORT_RESULT',
        relatedEntityId: 'report-1',
      }),
    );
  });

  it('REPORT_RESULT 이의 신청의 신고 내역이 본인 소유가 아니면 ticket을 만들지 않는다', async () => {
    const { command, createTicketWithMessage, findOwnedReportCase } = setup();
    findOwnedReportCase.mockResolvedValueOnce(null);

    await expect(
      command.execute({
        authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        request: {
          category: 'APPEAL',
          appealCategory: 'REPORT_RESULT',
          relatedEntityId: 'other-report-1',
          subject: '신고 처리 이의 신청',
          body: '재검토를 요청합니다.',
          emailReplyConsent: false,
        },
      }),
    ).rejects.toHaveProperty('response.code', 'SUPPORT_RELATED_REPORT_NOT_FOUND');

    expect(createTicketWithMessage).not.toHaveBeenCalled();
  });

  it('SANCTION/TEMPORARY_RESTRICTION 이의 신청이 제재 내역과 연결되면 소유권을 확인한다', async () => {
    const { command, createTicketWithMessage, findOwnedEnforcementNotice, tx } = setup();

    await command.execute({
      authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
      request: {
        category: 'APPEAL',
        appealCategory: 'SANCTION',
        relatedEntityId: 'season-participant:participant-1',
        subject: '이용 제한 이의 신청',
        body: '재검토를 요청합니다.',
        emailReplyConsent: false,
      },
    });

    expect(findOwnedEnforcementNotice).toHaveBeenCalledWith({
      client: tx,
      enforcementNoticeId: 'season-participant:participant-1',
      requesterUserId: 'user-1',
    });
    expect(createTicketWithMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'APPEAL',
        appealCategory: 'SANCTION',
        relatedEntityId: 'season-participant:participant-1',
      }),
    );
  });

  it('SANCTION 이의 신청의 제재 내역이 본인 소유가 아니면 ticket을 만들지 않는다', async () => {
    const { command, createTicketWithMessage, findOwnedEnforcementNotice } = setup();
    findOwnedEnforcementNotice.mockResolvedValueOnce(null);

    await expect(
      command.execute({
        authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        request: {
          category: 'APPEAL',
          appealCategory: 'SANCTION',
          relatedEntityId: 'season-participant:other-participant-1',
          subject: '이용 제한 이의 신청',
          body: '재검토를 요청합니다.',
          emailReplyConsent: false,
        },
      }),
    ).rejects.toHaveProperty('response.code', 'SUPPORT_RELATED_ENFORCEMENT_NOTICE_NOT_FOUND');

    expect(createTicketWithMessage).not.toHaveBeenCalled();
  });

  it('notification append 실패는 command 실패로 전파되어 transaction rollback 대상이 된다', async () => {
    const { command, createTicketWithMessage, appendTicketCreated, runSerializableTransaction } =
      setup();
    appendTicketCreated.mockRejectedValueOnce(new Error('notification append failed'));

    await expect(
      command.execute({
        authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        request: {
          category: 'BUG',
          subject: '버그 문의',
          body: '문의 본문',
          emailReplyConsent: true,
        },
      }),
    ).rejects.toThrow('notification append failed');

    expect(runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(createTicketWithMessage).toHaveBeenCalledTimes(1);
    expect(appendTicketCreated).toHaveBeenCalledTimes(1);
  });
});

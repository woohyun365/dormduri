import { describe, expect, it, vi, type Mocked } from 'vitest';
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
  const repository = {
    createTicketWithMessage,
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

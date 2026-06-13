import { describe, expect, it, vi, type Mocked } from 'vitest';
import { AppendSupportTicketMessageCommand } from './append-support-ticket-message.command.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  SupportTicketMessageRecord,
  SupportTicketRecord,
  SupportTicketRepository,
} from '../repositories/support-ticket.repository.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const existingTicket = {
  id: 'ticket-1',
  requesterUserId: 'user-1',
  category: 'BUG',
  subject: '버그 문의',
  status: 'OPEN',
  relatedEntityId: null,
  appealCategory: null,
  emailReplyConsent: false,
  lastMessageAt: now,
  closedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies SupportTicketRecord;
const appendedMessage = {
  id: 'message-2',
  ticketId: 'ticket-1',
  senderType: 'USER',
  senderUserId: 'user-1',
  body: '추가 문의',
  createdAt: now,
} satisfies SupportTicketMessageRecord;

function setup(ticket: SupportTicketRecord | null = existingTicket) {
  const tx = {} as never;
  const runSerializableTransaction = vi.fn((operation: (txArg: typeof tx) => unknown) =>
    Promise.resolve(operation(tx)),
  );
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    runSerializableTransaction,
  } as unknown as PrismaService;
  const findOwnedById = vi.fn().mockResolvedValue(ticket);
  const createMessage = vi.fn().mockResolvedValue(appendedMessage);
  const updateTicketStatus = vi
    .fn()
    .mockResolvedValue({ ...existingTicket, status: 'WAITING_OPERATOR', updatedAt: now });
  const repository = {
    findOwnedById,
    createMessage,
    updateTicketStatus,
  } as unknown as Mocked<SupportTicketRepository>;
  const command = new AppendSupportTicketMessageCommand(prisma, repository);

  return { command, findOwnedById, createMessage, updateTicketStatus, tx };
}

describe('AppendSupportTicketMessageCommand', () => {
  it('사용자 follow-up message와 status transition을 같은 transaction client에 요청한다', async () => {
    const { command, findOwnedById, createMessage, updateTicketStatus, tx } = setup();

    const response = await command.execute({
      authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
      ticketId: 'ticket-1',
      request: { body: '추가 문의' },
    });

    expect(findOwnedById).toHaveBeenCalledWith({
      id: 'ticket-1',
      requesterUserId: 'user-1',
      client: tx,
    });
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        ticketId: 'ticket-1',
        senderType: 'USER',
        senderUserId: 'user-1',
        body: '추가 문의',
        now,
      }),
    );
    expect(updateTicketStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        ticketId: 'ticket-1',
        status: 'WAITING_OPERATOR',
        lastMessageAt: now,
        closedAt: null,
        now,
      }),
    );
    expect(response).toMatchObject({
      ticket: { id: 'ticket-1', status: 'WAITING_OPERATOR' },
      message: { id: 'message-2', senderType: 'USER' },
    });
  });

  it('closed ticket policy rejection은 message/status side effect를 만들지 않는다', async () => {
    const { command, createMessage, updateTicketStatus } = setup({
      ...existingTicket,
      status: 'CLOSED',
      closedAt: now,
    });

    try {
      await command.execute({
        authUser: { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        ticketId: 'ticket-1',
        request: { body: '닫힌 티켓 추가 문의' },
      });
      throw new Error('Expected closed ticket append to fail');
    } catch (error: unknown) {
      const httpError = error as { getResponse: () => { code?: string } };
      expect(httpError.getResponse()).toMatchObject({ code: 'SUPPORT_TICKET_CLOSED' });
    }

    expect(createMessage).not.toHaveBeenCalled();
    expect(updateTicketStatus).not.toHaveBeenCalled();
  });
});

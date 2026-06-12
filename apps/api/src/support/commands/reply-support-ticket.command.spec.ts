import { describe, expect, it, vi, type Mocked } from 'vitest';
import { ReplySupportTicketCommand } from './reply-support-ticket.command.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SupportNotificationService } from '../notifications/support-notification.service.js';
import type { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const existingTicket = {
  id: 'ticket-1',
  requesterUserId: 'user-1',
  category: 'BUG',
  subject: '버그 문의',
  status: 'WAITING_OPERATOR',
  relatedEntityId: null,
  appealCategory: null,
  emailReplyConsent: false,
  lastMessageAt: now,
  closedAt: null,
  createdAt: now,
  updatedAt: now,
} as const;

describe('ReplySupportTicketCommand', () => {
  it('operator reply는 message/status update와 user notification을 같은 transaction에 요청한다', async () => {
    const tx = {} as never;
    const updatedTicket = { ...existingTicket, status: 'WAITING_USER' as const, updatedAt: now };
    const message = {
      id: 'message-1',
      ticketId: 'ticket-1',
      senderType: 'OPERATOR' as const,
      senderUserId: 'operator-1',
      body: '운영자 답변',
      createdAt: now,
    };
    const runSerializableTransaction = vi.fn((operation: (txArg: typeof tx) => unknown) =>
      Promise.resolve(operation(tx)),
    );
    const prisma = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      runSerializableTransaction,
    } as unknown as PrismaService;
    const findById = vi.fn().mockResolvedValue(existingTicket);
    const createMessage = vi.fn().mockResolvedValue(message);
    const updateTicketStatus = vi.fn().mockResolvedValue(updatedTicket);
    const repository = {
      findById,
      createMessage,
      updateTicketStatus,
    } as unknown as Mocked<SupportTicketRepository>;
    const appendTicketReplied = vi.fn().mockResolvedValue({ notificationId: 'n-1', created: true });
    const notificationService = {
      appendTicketReplied,
    } as unknown as Mocked<SupportNotificationService>;
    const command = new ReplySupportTicketCommand(prisma, repository, notificationService);

    const response = await command.execute({
      authUser: { id: 'operator-1', gender: 'M', campus: 'CHUNCHEON' },
      ticketId: 'ticket-1',
      request: { body: '운영자 답변', status: 'WAITING_USER' },
    });

    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        ticketId: 'ticket-1',
        senderType: 'OPERATOR',
        senderUserId: 'operator-1',
        body: '운영자 답변',
        now,
      }),
    );
    expect(updateTicketStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        ticketId: 'ticket-1',
        status: 'WAITING_USER',
        lastMessageAt: now,
        closedAt: null,
        now,
      }),
    );
    expect(appendTicketReplied).toHaveBeenCalledWith({
      tx,
      requesterUserId: 'user-1',
      operatorUserId: 'operator-1',
      supportTicketId: 'ticket-1',
      status: 'WAITING_USER',
      occurredAt: now,
    });
    expect(response).toMatchObject({
      ticket: { id: 'ticket-1', status: 'WAITING_USER' },
      message: { id: 'message-1', senderType: 'OPERATOR' },
    });
  });
});

import { ResolveSupportTicketCommand } from './resolve-support-ticket.command.js';
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

describe('ResolveSupportTicketCommand', () => {
  it('resolve는 message 없이 status/closedAt을 수렴시키고 pointer-only notification을 요청한다', async () => {
    const tx = {} as never;
    const resolvedTicket = { ...existingTicket, status: 'RESOLVED' as const, closedAt: now };
    const runSerializableTransaction = jest.fn((operation: (txArg: typeof tx) => unknown) =>
      Promise.resolve(operation(tx)),
    );
    const prisma = {
      getDatabaseNow: jest.fn().mockResolvedValue(now),
      runSerializableTransaction,
    } as unknown as PrismaService;
    const findById = jest.fn().mockResolvedValue(existingTicket);
    const updateTicketStatus = jest.fn().mockResolvedValue(resolvedTicket);
    const repository = {
      findById,
      updateTicketStatus,
    } as unknown as jest.Mocked<SupportTicketRepository>;
    const appendTicketReplied = jest
      .fn()
      .mockResolvedValue({ notificationId: 'n-1', created: true });
    const notificationService = {
      appendTicketReplied,
    } as unknown as jest.Mocked<SupportNotificationService>;
    const command = new ResolveSupportTicketCommand(prisma, repository, notificationService);

    const response = await command.execute({
      authUser: { id: 'operator-1', gender: 'M', campus: 'CHUNCHEON' },
      ticketId: 'ticket-1',
      request: { status: 'RESOLVED' },
    });

    expect(updateTicketStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        ticketId: 'ticket-1',
        status: 'RESOLVED',
        closedAt: now,
        now,
      }),
    );
    expect(appendTicketReplied).toHaveBeenCalledWith({
      tx,
      requesterUserId: 'user-1',
      operatorUserId: 'operator-1',
      supportTicketId: 'ticket-1',
      status: 'RESOLVED',
      occurredAt: now,
    });
    expect(response).toMatchObject({ ticket: { id: 'ticket-1', status: 'RESOLVED' } });
  });
});

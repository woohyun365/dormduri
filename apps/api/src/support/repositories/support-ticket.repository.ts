import { Injectable } from '@nestjs/common';
import type { SupportTicketCategory, SupportTicketStatus } from '@repo/shared/support';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SupportMessageSenderType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { SupportTicketCursor } from '../queries/support-ticket-list.cursor.js';

export const supportTicketSelect = {
  id: true,
  requesterUserId: true,
  category: true,
  subject: true,
  status: true,
  relatedEntityId: true,
  appealCategory: true,
  emailReplyConsent: true,
  lastMessageAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const supportTicketMessageSelect = {
  id: true,
  ticketId: true,
  senderType: true,
  senderUserId: true,
  body: true,
  createdAt: true,
} as const;

export type SupportTicketRecord = Prisma.SupportTicketGetPayload<{
  select: typeof supportTicketSelect;
}>;

export type SupportTicketMessageRecord = Prisma.SupportTicketMessageGetPayload<{
  select: typeof supportTicketMessageSelect;
}>;

export type SupportTicketRepositoryClient = Pick<
  Prisma.TransactionClient,
  'supportTicket' | 'supportTicketMessage'
>;

@Injectable()
export class SupportTicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForRequester(input: {
    requesterUserId: string;
    status?: SupportTicketStatus | null;
    category?: SupportTicketCategory | null;
    cursor: SupportTicketCursor | null;
    limit: number;
  }): Promise<SupportTicketRecord[]> {
    return this.prisma.supportTicket.findMany({
      where: {
        requesterUserId: input.requesterUserId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.cursor ? cursorWhere(input.cursor) : {}),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: supportTicketSelect,
    });
  }

  listForOperations(input: {
    status?: SupportTicketStatus | null;
    category?: SupportTicketCategory | null;
    cursor: SupportTicketCursor | null;
    limit: number;
  }): Promise<SupportTicketRecord[]> {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.cursor ? cursorWhere(input.cursor) : {}),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: supportTicketSelect,
    });
  }

  findById(input: {
    id: string;
    client?: SupportTicketRepositoryClient;
  }): Promise<SupportTicketRecord | null> {
    const client = input.client ?? this.prisma;
    return client.supportTicket.findUnique({
      where: { id: input.id },
      select: supportTicketSelect,
    });
  }

  findOwnedById(input: {
    id: string;
    requesterUserId: string;
    client?: SupportTicketRepositoryClient;
  }): Promise<SupportTicketRecord | null> {
    const client = input.client ?? this.prisma;
    return client.supportTicket.findFirst({
      where: { id: input.id, requesterUserId: input.requesterUserId },
      select: supportTicketSelect,
    });
  }

  listMessages(input: {
    ticketId: string;
    client?: SupportTicketRepositoryClient;
  }): Promise<SupportTicketMessageRecord[]> {
    const client = input.client ?? this.prisma;
    return client.supportTicketMessage.findMany({
      where: { ticketId: input.ticketId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: supportTicketMessageSelect,
    });
  }

  async createTicketWithMessage(input: {
    client: SupportTicketRepositoryClient;
    requesterUserId: string;
    category: SupportTicketCategory;
    subject: string;
    body: string;
    relatedEntityId?: string | null;
    appealCategory?: SupportTicketRecord['appealCategory'];
    emailReplyConsent: boolean;
    now: Date;
  }): Promise<{ ticket: SupportTicketRecord; message: SupportTicketMessageRecord }> {
    const ticket = await input.client.supportTicket.create({
      data: {
        requesterUserId: input.requesterUserId,
        category: input.category,
        subject: input.subject,
        status: 'OPEN',
        relatedEntityId: input.relatedEntityId ?? null,
        appealCategory: input.appealCategory ?? null,
        emailReplyConsent: input.emailReplyConsent,
        lastMessageAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: supportTicketSelect,
    });
    const message = await this.createMessage({
      client: input.client,
      ticketId: ticket.id,
      senderType: 'USER',
      senderUserId: input.requesterUserId,
      body: input.body,
      now: input.now,
    });

    return { ticket, message };
  }

  createMessage(input: {
    client: SupportTicketRepositoryClient;
    ticketId: string;
    senderType: SupportMessageSenderType;
    senderUserId: string | null;
    body: string;
    now: Date;
  }): Promise<SupportTicketMessageRecord> {
    return input.client.supportTicketMessage.create({
      data: {
        ticketId: input.ticketId,
        senderType: input.senderType,
        senderUserId: input.senderUserId,
        body: input.body,
        createdAt: input.now,
      },
      select: supportTicketMessageSelect,
    });
  }

  updateTicketStatus(input: {
    client: SupportTicketRepositoryClient;
    ticketId: string;
    status: SupportTicketStatus;
    lastMessageAt?: Date;
    closedAt?: Date | null;
    now: Date;
  }): Promise<SupportTicketRecord> {
    return input.client.supportTicket.update({
      where: { id: input.ticketId },
      data: {
        status: input.status,
        ...(input.lastMessageAt ? { lastMessageAt: input.lastMessageAt } : {}),
        ...(input.closedAt !== undefined ? { closedAt: input.closedAt } : {}),
        updatedAt: input.now,
      },
      select: supportTicketSelect,
    });
  }
}

function cursorWhere(cursor: SupportTicketCursor): Prisma.SupportTicketWhereInput {
  return {
    OR: [
      { lastMessageAt: { lt: cursor.lastMessageAt } },
      { lastMessageAt: cursor.lastMessageAt, id: { lt: cursor.id } },
    ],
  };
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  ChatReportMessageTargetContext,
  ChatReportTargetClient,
  ChatReportTargetContextPort,
  ChatReportThreadTargetContext,
} from '../application/ports/chat-report-target-context.port.js';

@Injectable()
export class ChatReportTargetContextResolver implements ChatReportTargetContextPort {
  constructor(private readonly prisma: PrismaService) {}

  async resolveThreadTarget(input: {
    actorParticipantId: string;
    seasonId: string;
    threadId: string;
    client?: ChatReportTargetClient;
  }): Promise<ChatReportThreadTargetContext | null> {
    const db = input.client ?? this.prisma;
    const thread = await db.conversationThread.findFirst({
      where: {
        id: input.threadId,
        seasonId: input.seasonId,
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            participantId: input.actorParticipantId,
            memberState: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        seasonId: true,
        participantAId: true,
        participantBId: true,
        threadKind: true,
        status: true,
        closedReason: true,
        participantA: { select: { id: true, userId: true } },
        participantB: { select: { id: true, userId: true } },
      },
    });
    if (!thread) {
      return null;
    }

    const counterpart =
      thread.participantAId === input.actorParticipantId
        ? thread.participantB
        : thread.participantBId === input.actorParticipantId
          ? thread.participantA
          : null;
    if (!counterpart) {
      return null;
    }

    return {
      threadId: thread.id,
      seasonId: thread.seasonId,
      counterpartUserId: counterpart.userId,
      counterpartParticipantId: counterpart.id,
      participantAId: thread.participantAId,
      participantBId: thread.participantBId,
      threadKind: thread.threadKind,
      status: thread.status as 'OPEN' | 'READ_ONLY',
      closedReason: thread.closedReason,
    };
  }

  async resolveMessageTarget(input: {
    actorParticipantId: string;
    seasonId: string;
    messageId: string;
    client?: ChatReportTargetClient;
  }): Promise<ChatReportMessageTargetContext | null> {
    const db = input.client ?? this.prisma;
    const message = await db.conversationMessage.findFirst({
      where: {
        id: input.messageId,
        deletedAt: null,
        thread: {
          seasonId: input.seasonId,
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: {
            some: {
              participantId: input.actorParticipantId,
              memberState: 'ACTIVE',
            },
          },
        },
      },
      select: {
        id: true,
        threadId: true,
        senderParticipantId: true,
        bodyState: true,
        tombstoneReason: true,
        thread: {
          select: {
            seasonId: true,
            participantAId: true,
            participantBId: true,
          },
        },
        senderParticipant: { select: { id: true, userId: true } },
      },
    });
    if (!message) {
      return null;
    }

    return {
      messageId: message.id,
      threadId: message.threadId,
      seasonId: message.thread.seasonId,
      senderUserId: message.senderParticipant.userId,
      senderParticipantId: message.senderParticipant.id,
      participantAId: message.thread.participantAId,
      participantBId: message.thread.participantBId,
      bodyState: message.bodyState,
      tombstoneReason: message.tombstoneReason,
    };
  }
}

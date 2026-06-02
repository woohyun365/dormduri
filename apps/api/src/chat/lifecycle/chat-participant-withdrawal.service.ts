import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type ChatThreadWithdrawalPort,
  type ChatThreadWithdrawalResult,
} from '../application/ports/chat-thread-withdrawal.port.js';
import {
  ChatRealtimeOutboxService,
  hasChatRealtimeOutboxTx,
} from '../outbox/chat-realtime-outbox.service.js';
import { threadSelect } from '../persistence/chat-thread.select.js';

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

@Injectable()
export class ChatParticipantWithdrawalService implements ChatThreadWithdrawalPort {
  async markOpenDirectThreadsReadOnlyForWithdrawnParticipant(
    tx: Prisma.TransactionClient,
    input: {
      seasonId: string;
      participantId: string;
      now: Date;
    },
  ): Promise<ChatThreadWithdrawalResult> {
    const candidateThreads = await tx.conversationThread.findMany({
      where: {
        seasonId: input.seasonId,
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'OPEN',
        OR: [{ participantAId: input.participantId }, { participantBId: input.participantId }],
      },
      orderBy: [{ id: 'asc' }],
      select: threadSelect,
    });

    if (candidateThreads.length === 0) {
      return { updatedThreadIds: [] };
    }

    const candidateThreadIds = candidateThreads.map((thread) => thread.id);
    await tx.conversationThread.updateMany({
      where: {
        id: { in: candidateThreadIds },
        status: 'OPEN',
        activeMatchId: null,
      },
      data: {
        status: 'READ_ONLY',
        closedReason: 'PARTICIPANT_WITHDRAWN',
        closedAt: input.now,
      },
    });

    const updatedThreads = await tx.conversationThread.findMany({
      where: {
        id: { in: candidateThreadIds },
        status: 'READ_ONLY',
        closedReason: 'PARTICIPANT_WITHDRAWN',
      },
      orderBy: [{ id: 'asc' }],
      select: threadSelect,
    });

    if (hasChatRealtimeOutboxTx(tx)) {
      for (const thread of updatedThreads) {
        await chatRealtimeOutbox.appendThreadUpdated(tx, {
          threadId: thread.id,
          status: thread.status,
          closedReason: thread.closedReason,
          recipientUserIds: [thread.participantA.userId, thread.participantB.userId],
          occurredAt: input.now,
        });
      }
    }

    return {
      updatedThreadIds: updatedThreads.map((thread) => thread.id),
    };
  }
}

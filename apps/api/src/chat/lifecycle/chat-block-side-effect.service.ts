import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  ChatBlockSideEffectInput,
  ChatBlockSideEffectPort,
  ChatBlockSideEffectResult,
} from '../application/ports/chat-block-side-effect.port.js';
import {
  ChatRealtimeOutboxService,
  hasChatRealtimeOutboxTx,
} from '../outbox/chat-realtime-outbox.service.js';
import { threadSelect } from '../persistence/chat-thread.select.js';

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

@Injectable()
export class ChatBlockSideEffectService implements ChatBlockSideEffectPort {
  async closeDirectThreadsForBlock(
    tx: Prisma.TransactionClient,
    input: ChatBlockSideEffectInput,
  ): Promise<ChatBlockSideEffectResult> {
    const participants = await tx.seasonParticipant.findMany({
      where: {
        seasonId: input.seasonId,
        userId: { in: [input.blockerUserId, input.blockedUserId] },
      },
      select: { id: true, userId: true },
    });
    const blockerParticipant = participants.find(
      (participant) => participant.userId === input.blockerUserId,
    );
    const blockedParticipant = participants.find(
      (participant) => participant.userId === input.blockedUserId,
    );
    if (!blockerParticipant || !blockedParticipant) {
      return { closedThreadIds: [] };
    }

    const pairKey = [blockerParticipant.id, blockedParticipant.id].sort().join(':');
    const candidateThreads = await tx.conversationThread.findMany({
      where: {
        seasonId: input.seasonId,
        pairKey,
        threadKind: 'DIRECT',
        activeMatchId: null,
        status: 'OPEN',
      },
      select: { id: true },
      orderBy: [{ id: 'asc' }],
    });
    const candidateThreadIds = candidateThreads.map((thread) => thread.id);
    if (candidateThreadIds.length === 0) {
      return { closedThreadIds: [] };
    }

    await tx.conversationThread.updateMany({
      where: {
        id: { in: candidateThreadIds },
        status: 'OPEN',
        threadKind: 'DIRECT',
        activeMatchId: null,
      },
      data: {
        status: 'READ_ONLY',
        closedReason: 'USER_BLOCKED',
        closedAt: input.occurredAt,
      },
    });

    const updatedThreads = await tx.conversationThread.findMany({
      where: {
        id: { in: candidateThreadIds },
        status: 'READ_ONLY',
        closedReason: 'USER_BLOCKED',
        closedAt: input.occurredAt,
      },
      select: threadSelect,
      orderBy: [{ id: 'asc' }],
    });

    for (const thread of updatedThreads) {
      if (!hasChatRealtimeOutboxTx(tx)) {
        continue;
      }
      await chatRealtimeOutbox.appendThreadUpdated(tx, {
        threadId: thread.id,
        status: thread.status,
        closedReason: thread.closedReason,
        recipientUserIds: [thread.participantA.userId, thread.participantB.userId],
        occurredAt: input.occurredAt,
      });
    }

    return { closedThreadIds: updatedThreads.map((thread) => thread.id) };
  }
}

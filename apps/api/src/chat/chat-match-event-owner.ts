import type { Prisma } from '../generated/prisma/client.js';
import { threadSelect, type ThreadRecord } from './chat-selects.js';

interface ChatMatchEventOwnerDeps {
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
  formatKstDate(date: Date): string;
}

export function createChatMatchEventOwner(deps: ChatMatchEventOwnerDeps) {
  return {
    async handleActiveMatchCreated(
      tx: Prisma.TransactionClient,
      input: {
        seasonId: string;
        pairKey: string;
        participantAId: string;
        participantBId: string;
        activeMatchId: string;
      },
      now: Date,
    ) {
      const existingPairThread = await tx.conversationThread.findFirst({
        where: {
          seasonId: input.seasonId,
          pairKey: input.pairKey,
          status: { in: ['OPEN', 'READ_ONLY'] },
        },
        select: { id: true },
      });

      if (existingPairThread) {
        await tx.conversationThread.update({
          where: { id: existingPairThread.id },
          data: {
            threadKind: 'MATCHED',
            activeMatchId: input.activeMatchId,
            status: 'OPEN',
            closedReason: null,
            closedAt: null,
          },
        });
      }

      await tx.conversationThread.updateMany({
        where: {
          seasonId: input.seasonId,
          id: existingPairThread ? { not: existingPairThread.id } : undefined,
          status: 'OPEN',
          activeMatchId: null,
          OR: [
            { participantAId: { in: [input.participantAId, input.participantBId] } },
            { participantBId: { in: [input.participantAId, input.participantBId] } },
          ],
        },
        data: {
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
          closedAt: now,
        },
      });
    },

    async handleActiveMatchUnmatched(
      tx: Prisma.TransactionClient,
      input: {
        activeMatchId: string;
      },
      now: Date,
    ) {
      const matchedThread = await tx.conversationThread.findFirst({
        where: {
          activeMatchId: input.activeMatchId,
          status: { in: ['OPEN', 'READ_ONLY'] },
        },
        select: threadSelect,
      });

      if (!matchedThread) {
        return;
      }

      const roomSelectionDate = deps.findThreadRoomSelectionDate(matchedThread);
      const shouldRemainOpen = roomSelectionDate
        ? deps.formatKstDate(now) <= roomSelectionDate
        : false;
      const nextStatus =
        matchedThread.status === 'READ_ONLY'
          ? 'READ_ONLY'
          : shouldRemainOpen
            ? 'OPEN'
            : 'READ_ONLY';
      const nextClosedReason =
        nextStatus === 'OPEN' ? null : (matchedThread.closedReason ?? 'ROOM_SELECTION_CUTOFF');
      const nextClosedAt = nextStatus === 'OPEN' ? null : (matchedThread.closedAt ?? now);

      await tx.conversationThread.update({
        where: { id: matchedThread.id },
        data: {
          threadKind: 'DIRECT',
          activeMatchId: null,
          status: nextStatus,
          closedReason: nextClosedReason,
          closedAt: nextClosedAt,
        },
      });
    },
  };
}

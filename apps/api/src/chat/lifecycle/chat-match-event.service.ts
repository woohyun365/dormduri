import type { Prisma } from '../../generated/prisma/client.js';
import { resolveDirectThreadReopenStaticDecision } from '../policies/chat-direct-thread-reopen-policy.js';
import { threadSelect, type ThreadRecord } from '../persistence/chat-thread.select.js';
import {
  ChatRealtimeOutboxService,
  hasChatRealtimeOutboxTx,
} from '../outbox/chat-realtime-outbox.service.js';

interface ChatMatchEventOwnerDeps {
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
  formatKstDate(date: Date): string;
  canReopenDirectThreadAfterUnmatch?(
    tx: Prisma.TransactionClient,
    thread: ThreadRecord,
    now: Date,
  ): Promise<boolean>;
}

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

export function createChatMatchEventOwner(deps: ChatMatchEventOwnerDeps) {
  async function appendThreadUpdatedIfSupported(
    tx: Prisma.TransactionClient,
    thread: ThreadRecord,
    now: Date,
  ) {
    if (!hasChatRealtimeOutboxTx(tx)) {
      return;
    }

    await chatRealtimeOutbox.appendThreadUpdated(tx, {
      threadId: thread.id,
      status: thread.status,
      closedReason: thread.closedReason,
      recipientUserIds: [thread.participantA.userId, thread.participantB.userId],
      occurredAt: now,
    });
  }

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
        select: threadSelect,
      });

      if (existingPairThread) {
        const updatedPairThread = await tx.conversationThread.update({
          where: { id: existingPairThread.id },
          data: {
            threadKind: 'MATCHED',
            activeMatchId: input.activeMatchId,
            status: 'OPEN',
            closedReason: null,
            closedAt: null,
          },
          select: threadSelect,
        });
        await appendThreadUpdatedIfSupported(tx, updatedPairThread, now);
      }

      const otherOpenThreadWhere = {
        seasonId: input.seasonId,
        id: existingPairThread ? { not: existingPairThread.id } : undefined,
        status: 'OPEN' as const,
        activeMatchId: null,
        OR: [
          { participantAId: { in: [input.participantAId, input.participantBId] } },
          { participantBId: { in: [input.participantAId, input.participantBId] } },
        ],
      };
      const affectedThreads =
        typeof tx.conversationThread.findMany === 'function'
          ? await tx.conversationThread.findMany({
              where: otherOpenThreadWhere,
              select: { id: true },
            })
          : [];
      const affectedThreadIds = affectedThreads.map((thread) => thread.id);

      if (affectedThreadIds.length > 0) {
        await tx.conversationThread.updateMany({
          where: {
            id: { in: affectedThreadIds },
            status: 'OPEN',
          },
          data: {
            status: 'READ_ONLY',
            closedReason: 'ACTIVE_MATCH_CREATED',
            closedAt: now,
          },
        });
      }

      const updatedAffectedThreads =
        affectedThreadIds.length > 0 && typeof tx.conversationThread.findMany === 'function'
          ? await tx.conversationThread.findMany({
              where: {
                id: { in: affectedThreadIds },
                status: 'READ_ONLY',
                closedReason: 'ACTIVE_MATCH_CREATED',
                closedAt: now,
              },
              select: threadSelect,
            })
          : [];

      for (const affectedThread of updatedAffectedThreads) {
        await appendThreadUpdatedIfSupported(tx, affectedThread, now);
      }
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

      const updatedThread = await tx.conversationThread.update({
        where: { id: matchedThread.id },
        data: {
          threadKind: 'DIRECT',
          activeMatchId: null,
          status: nextStatus,
          closedReason: nextClosedReason,
          closedAt: nextClosedAt,
        },
        select: threadSelect,
      });
      await appendThreadUpdatedIfSupported(tx, updatedThread, now);

      const reopenCandidates =
        typeof tx.conversationThread.findMany === 'function'
          ? await tx.conversationThread.findMany({
              where: {
                seasonId: matchedThread.seasonId,
                id: { not: matchedThread.id },
                threadKind: 'DIRECT',
                activeMatchId: null,
                status: 'READ_ONLY',
                closedReason: 'ACTIVE_MATCH_CREATED',
                OR: [
                  {
                    participantAId: {
                      in: [matchedThread.participantAId, matchedThread.participantBId],
                    },
                  },
                  {
                    participantBId: {
                      in: [matchedThread.participantAId, matchedThread.participantBId],
                    },
                  },
                ],
              },
              orderBy: [{ id: 'asc' }],
              select: threadSelect,
            })
          : [];
      const reopenThreadIds: string[] = [];
      for (const candidate of reopenCandidates) {
        const staticDecision = resolveDirectThreadReopenStaticDecision({
          thread: candidate,
          now,
          findThreadRoomSelectionDate: (thread) => deps.findThreadRoomSelectionDate(thread),
          formatKstDate: (date) => deps.formatKstDate(date),
        });
        if (staticDecision.kind !== 'REOPEN_CANDIDATE') {
          continue;
        }
        if (!(await deps.canReopenDirectThreadAfterUnmatch?.(tx, candidate, now))) {
          continue;
        }
        reopenThreadIds.push(candidate.id);
      }

      if (reopenThreadIds.length > 0) {
        await tx.conversationThread.updateMany({
          where: {
            id: { in: reopenThreadIds },
            status: 'READ_ONLY',
            closedReason: 'ACTIVE_MATCH_CREATED',
          },
          data: {
            status: 'OPEN',
            closedReason: null,
            closedAt: null,
          },
        });
      }

      const reopenedThreads =
        reopenThreadIds.length > 0 && typeof tx.conversationThread.findMany === 'function'
          ? await tx.conversationThread.findMany({
              where: {
                id: { in: reopenThreadIds },
                status: 'OPEN',
                closedReason: null,
                closedAt: null,
              },
              orderBy: [{ id: 'asc' }],
              select: threadSelect,
            })
          : [];

      for (const reopenedThread of reopenedThreads) {
        await appendThreadUpdatedIfSupported(tx, reopenedThread, now);
      }
    },
  };
}

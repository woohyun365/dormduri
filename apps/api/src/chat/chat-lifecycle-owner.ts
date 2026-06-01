import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { threadSelect, type ThreadRecord } from './chat-selects.js';
import {
  ChatRealtimeOutboxService,
  hasChatRealtimeOutboxTx,
} from './outbox/chat-realtime-outbox.service.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;
const chatRealtimeOutbox = new ChatRealtimeOutboxService();

interface ChatLifecycleOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
}

export function createChatLifecycleOwner(deps: ChatLifecycleOwnerDeps) {
  async function appendLifecycleOutboxIfSupported(
    client: ChatDbClient,
    thread: ThreadRecord,
    now: Date,
  ) {
    if (!hasChatRealtimeOutboxTx(client)) {
      return;
    }

    const recipientUserIds = [thread.participantA.userId, thread.participantB.userId];

    if (thread.status === 'ARCHIVED') {
      await chatRealtimeOutbox.appendThreadArchived(client, {
        threadId: thread.id,
        closedAt: thread.closedAt ?? now,
        closedReason: thread.closedReason,
        recipientUserIds,
      });
      return;
    }

    await chatRealtimeOutbox.appendThreadUpdated(client, {
      threadId: thread.id,
      status: thread.status,
      closedReason: thread.closedReason,
      recipientUserIds,
      occurredAt: now,
    });
  }

  async function updateThreadAndAppendOutbox(
    client: ChatDbClient,
    threadId: string,
    data: Record<string, unknown>,
    now: Date,
  ) {
    const updated = await client.conversationThread.update({
      where: { id: threadId },
      data,
      select: threadSelect,
    });

    await appendLifecycleOutboxIfSupported(client, updated, now);

    return updated;
  }

  return {
    async synchronizeThreadLifecycle(
      thread: ThreadRecord,
      now: Date,
      client: ChatDbClient = deps.prisma,
    ): Promise<ThreadRecord> {
      const today = formatKstDate(now);
      const currentSeasonContext = await deps.seasonsService.getCurrentSeasonContext(
        thread.season.campusCode,
        now,
      );
      const hasNewerCurrentSeason =
        currentSeasonContext !== null && currentSeasonContext.season.id !== thread.seasonId;
      const nextData: Record<string, unknown> = {};

      if (hasNewerCurrentSeason) {
        if (thread.status !== 'ARCHIVED') {
          nextData.status = 'ARCHIVED';
          nextData.closedReason = thread.closedReason ?? 'SEASON_ENDED';
          nextData.closedAt = thread.closedAt ?? now;
        }
      } else if (thread.activeMatch) {
        if (thread.threadKind !== 'MATCHED') {
          nextData.threadKind = 'MATCHED';
          nextData.activeMatchId = thread.activeMatch.id;
        }

        if (today > formatKstDate(thread.season.seasonEndDate)) {
          if (thread.status !== 'READ_ONLY') {
            nextData.status = 'READ_ONLY';
            nextData.closedReason = thread.closedReason ?? 'SEASON_ENDED';
            nextData.closedAt = thread.closedAt ?? now;
          }
        } else if (thread.status !== 'OPEN') {
          nextData.status = 'OPEN';
          nextData.closedReason = null;
          nextData.closedAt = null;
        }
      } else {
        const roomSelectionDate = deps.findThreadRoomSelectionDate(thread);
        if (today > formatKstDate(thread.season.seasonEndDate)) {
          if (thread.status !== 'READ_ONLY') {
            nextData.status = 'READ_ONLY';
            nextData.closedReason = thread.closedReason ?? 'SEASON_ENDED';
            nextData.closedAt = thread.closedAt ?? now;
          }
        } else if (roomSelectionDate && today > roomSelectionDate) {
          if (thread.status !== 'READ_ONLY') {
            nextData.status = 'READ_ONLY';
            nextData.closedReason = thread.closedReason ?? 'ROOM_SELECTION_CUTOFF';
            nextData.closedAt = thread.closedAt ?? now;
          }
        }
      }

      if (Object.keys(nextData).length === 0) {
        return thread;
      }

      if (client === deps.prisma && hasChatRealtimeOutboxTx(deps.prisma)) {
        return deps.prisma.runSerializableTransaction((tx) =>
          updateThreadAndAppendOutbox(tx, thread.id, nextData, now),
        );
      }

      return updateThreadAndAppendOutbox(client, thread.id, nextData, now);
    },

    async sweepThreadLifecycle(now: Date) {
      const candidateThreads = await deps.prisma.conversationThread.findMany({
        where: {
          status: { in: ['OPEN', 'READ_ONLY'] },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        select: threadSelect,
      });

      let updatedCount = 0;

      for (const thread of candidateThreads) {
        const synchronized = await this.synchronizeThreadLifecycle(thread, now);
        if (
          synchronized.status !== thread.status ||
          synchronized.threadKind !== thread.threadKind ||
          synchronized.activeMatchId !== thread.activeMatchId ||
          synchronized.closedReason !== thread.closedReason ||
          synchronized.closedAt?.getTime() !== thread.closedAt?.getTime()
        ) {
          updatedCount += 1;
        }
      }

      return {
        scannedCount: candidateThreads.length,
        updatedCount,
      };
    },
  };
}

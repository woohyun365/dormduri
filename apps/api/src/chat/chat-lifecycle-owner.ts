import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { threadSelect, type ThreadRecord } from './chat-selects.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;

interface ChatLifecycleOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
}

export function createChatLifecycleOwner(deps: ChatLifecycleOwnerDeps) {
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

      return client.conversationThread.update({
        where: { id: thread.id },
        data: nextData,
        select: threadSelect,
      });
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

import type { Prisma } from '../../generated/prisma/client.js';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import type {
  ChatLifecycleSweepPort,
  ChatLifecycleSweepResult,
} from '../application/ports/chat-lifecycle-sweep.port.js';
import { createChatThreadSupportOwner } from '../policies/chat-thread-policy.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import { threadSelect, type ThreadRecord } from '../persistence/chat-thread.select.js';
import {
  ChatRealtimeOutboxService,
  hasChatRealtimeOutboxTx,
} from '../outbox/chat-realtime-outbox.service.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;
const chatRealtimeOutbox = new ChatRealtimeOutboxService();

interface ChatSeasonLifecycleOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
}

export function createChatSeasonLifecycleOwner(deps: ChatSeasonLifecycleOwnerDeps) {
  async function resolveThreadLifecycleData(thread: ThreadRecord, now: Date) {
    const today = formatKstDate(now);
    const currentSeasonContext = await deps.seasonsService.getCurrentSeasonContext(
      thread.season.campusCode,
      now,
    );
    const hasNewerCurrentSeason =
      currentSeasonContext !== null && currentSeasonContext.season.id !== thread.seasonId;
    const nextData: Partial<
      Pick<ThreadRecord, 'activeMatchId' | 'closedAt' | 'closedReason' | 'status' | 'threadKind'>
    > = {};

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

    return nextData;
  }

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
    async resolveThreadLifecycleSnapshot(thread: ThreadRecord, now: Date): Promise<ThreadRecord> {
      const nextData = await resolveThreadLifecycleData(thread, now);

      return Object.keys(nextData).length === 0 ? thread : { ...thread, ...nextData };
    },

    async synchronizeThreadLifecycle(
      thread: ThreadRecord,
      now: Date,
      client: ChatDbClient = deps.prisma,
    ): Promise<ThreadRecord> {
      const nextData = await resolveThreadLifecycleData(thread, now);

      if (Object.keys(nextData).length === 0) {
        return thread;
      }

      if (client === deps.prisma && hasChatRealtimeOutboxTx(deps.prisma)) {
        return deps.prisma.runSerializableTransaction((tx) =>
          updateThreadAndAppendOutbox(tx, thread.id, nextData as Record<string, unknown>, now),
        );
      }

      return updateThreadAndAppendOutbox(
        client,
        thread.id,
        nextData as Record<string, unknown>,
        now,
      );
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

@Injectable()
export class ChatSeasonLifecycleService implements ChatLifecycleSweepPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

  private get threadSupportOwner() {
    return createChatThreadSupportOwner({
      prisma: this.prisma,
      seasonParticipantsService: this.seasonParticipantsService,
    });
  }

  private get owner() {
    return createChatSeasonLifecycleOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      findThreadRoomSelectionDate: (thread) =>
        this.threadSupportOwner.findThreadRoomSelectionDate(thread),
    });
  }

  resolveThreadLifecycleSnapshot(thread: ThreadRecord, now: Date): Promise<ThreadRecord> {
    return this.owner.resolveThreadLifecycleSnapshot(thread, now);
  }

  synchronizeThreadLifecycle(
    thread: ThreadRecord,
    now: Date,
    client?: ChatDbClient,
  ): Promise<ThreadRecord> {
    return this.owner.synchronizeThreadLifecycle(thread, now, client);
  }

  sweepThreadLifecycle(now: Date): Promise<ChatLifecycleSweepResult> {
    return this.owner.sweepThreadLifecycle(now);
  }
}

import type { Prisma } from '../../generated/prisma/client.js';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
} from '../../generated/prisma/enums.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import {
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
} from '../../seasons/ports/season-context.port.js';
import {
  type ActiveMatchCreatedChatLifecycleInput,
  type ActiveMatchUnmatchedChatLifecycleInput,
  type ChatMatchThreadLifecyclePort,
} from '../application/ports/chat-match-thread-lifecycle.port.js';
import { createChatUserContextService } from '../application/chat-user-context.service.js';
import { resolveDirectThreadReopenStaticDecision } from '../policies/chat-direct-thread-reopen-policy.js';
import { createChatThreadSupportOwner } from '../policies/chat-thread-policy.js';
import { threadSelect, type ThreadRecord } from '../persistence/chat-thread.select.js';
import { toConversationThreadLifecycleTransitionMetadata } from '../lifecycle-events/conversation-thread-lifecycle-event.transition.js';
import {
  type ConversationThreadLifecycleEventAppender,
  ConversationThreadLifecycleEventWriter,
  noopConversationThreadLifecycleEventAppender,
} from '../lifecycle-events/conversation-thread-lifecycle-event.writer.js';
import {
  ChatRealtimeOutboxService,
  hasChatRealtimeOutboxTx,
} from '../outbox/chat-realtime-outbox.service.js';

interface ChatMatchThreadLifecycleOwnerDeps {
  lifecycleEventWriter?: ConversationThreadLifecycleEventAppender;
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
  formatKstDate(date: Date): string;
  canReopenDirectThreadAfterUnmatch?(
    tx: Prisma.TransactionClient,
    thread: ThreadRecord,
    now: Date,
  ): Promise<boolean>;
}

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

export function createChatMatchThreadLifecycleOwner(deps: ChatMatchThreadLifecycleOwnerDeps) {
  async function appendThreadLifecycleEvent(
    tx: Prisma.TransactionClient,
    input: {
      thread: ThreadRecord;
      previous: Partial<ThreadRecord> | null;
      eventType: ConversationThreadLifecycleEventType;
      reason: ConversationThreadLifecycleEventReason;
      now: Date;
      sourceActiveMatchId?: string;
    },
  ) {
    await deps.lifecycleEventWriter?.append(tx, {
      threadId: input.thread.id,
      eventType: input.eventType,
      reason: input.reason,
      sourceDomain: ConversationThreadLifecycleSourceDomain.MATCHES,
      sourceActiveMatchId: input.sourceActiveMatchId,
      occurredAt: input.now,
      metadata: toConversationThreadLifecycleTransitionMetadata({
        previous: input.previous,
        next: input.thread,
      }),
    });
  }

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
        await appendThreadLifecycleEvent(tx, {
          thread: updatedPairThread,
          previous: existingPairThread,
          eventType:
            existingPairThread.status !== 'OPEN' && updatedPairThread.status === 'OPEN'
              ? ConversationThreadLifecycleEventType.THREAD_REOPENED
              : ConversationThreadLifecycleEventType.THREAD_KIND_CHANGED,
          reason: ConversationThreadLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
          sourceActiveMatchId: input.activeMatchId,
          now,
        });
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
        await appendThreadLifecycleEvent(tx, {
          thread: affectedThread,
          previous: { status: 'OPEN', threadKind: 'DIRECT', closedReason: null },
          eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
          reason: ConversationThreadLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
          sourceActiveMatchId: input.activeMatchId,
          now,
        });
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
      await appendThreadLifecycleEvent(tx, {
        thread: updatedThread,
        previous: matchedThread,
        eventType:
          updatedThread.status === 'READ_ONLY'
            ? ConversationThreadLifecycleEventType.THREAD_READ_ONLY
            : ConversationThreadLifecycleEventType.THREAD_KIND_CHANGED,
        reason: ConversationThreadLifecycleEventReason.ACTIVE_MATCH_ENDED,
        sourceActiveMatchId: input.activeMatchId,
        now,
      });

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
        await appendThreadLifecycleEvent(tx, {
          thread: reopenedThread,
          previous: {
            status: 'READ_ONLY',
            threadKind: 'DIRECT',
            closedReason: 'ACTIVE_MATCH_CREATED',
          },
          eventType: ConversationThreadLifecycleEventType.THREAD_REOPENED,
          reason: ConversationThreadLifecycleEventReason.ACTIVE_MATCH_ENDED,
          sourceActiveMatchId: input.activeMatchId,
          now,
        });
      }
    },
  };
}

@Injectable()
export class ChatMatchThreadLifecycleService implements ChatMatchThreadLifecyclePort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Optional()
    @Inject(ConversationThreadLifecycleEventWriter)
    private readonly lifecycleEventWriter: ConversationThreadLifecycleEventAppender = noopConversationThreadLifecycleEventAppender,
  ) {}

  private get contextOwner() {
    return createChatUserContextService({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
    });
  }

  private get threadSupportOwner() {
    return createChatThreadSupportOwner({
      prisma: this.prisma,
      seasonParticipantsService: this.seasonParticipantsService,
    });
  }

  private get owner() {
    return createChatMatchThreadLifecycleOwner({
      lifecycleEventWriter: this.lifecycleEventWriter,
      findThreadRoomSelectionDate: (thread) =>
        this.threadSupportOwner.findThreadRoomSelectionDate(thread),
      formatKstDate,
      canReopenDirectThreadAfterUnmatch: (tx, thread, now) =>
        this.canReopenDirectThreadAfterUnmatch(tx, thread, now),
    });
  }

  handleActiveMatchCreated(
    tx: Prisma.TransactionClient,
    input: ActiveMatchCreatedChatLifecycleInput,
    now: Date,
  ): Promise<void> {
    return this.owner.handleActiveMatchCreated(tx, input, now);
  }

  handleActiveMatchUnmatched(
    tx: Prisma.TransactionClient,
    input: ActiveMatchUnmatchedChatLifecycleInput,
    now: Date,
  ): Promise<void> {
    return this.owner.handleActiveMatchUnmatched(tx, input, now);
  }

  private async canReopenDirectThreadAfterUnmatch(
    tx: Prisma.TransactionClient,
    thread: ThreadRecord,
    now: Date,
  ) {
    const participantAUser = await this.contextOwner.getChatUserProjection(
      thread.participantA.userId,
      tx,
    );
    const participantBUser = await this.contextOwner.getChatUserProjection(
      thread.participantB.userId,
      tx,
    );

    if (
      !participantAUser ||
      !participantBUser ||
      participantAUser.id === participantBUser.id ||
      participantAUser.campus !== participantBUser.campus ||
      participantAUser.gender !== participantBUser.gender
    ) {
      return false;
    }

    const participantA = await this.seasonParticipantsService.findCurrentSeasonParticipant(
      participantAUser.id,
      thread.seasonId,
      tx,
    );
    const participantB = await this.seasonParticipantsService.findCurrentSeasonParticipant(
      participantBUser.id,
      thread.seasonId,
      tx,
    );

    if (!participantA || !participantB) {
      return false;
    }

    const seasonContext = toCurrentSeasonResponse(normalizeSeasonRuntimeRow(thread.season), now);
    const virtualOpenThread = {
      ...thread,
      status: 'OPEN' as const,
      closedReason: null,
      closedAt: null,
    };
    const decision = await this.threadSupportOwner.canSendMessageToPair(
      {
        user: participantAUser,
        seasonContext,
        participant: participantA,
        selection: this.seasonParticipantsService.selectCanonicalSelection(participantA),
      },
      participantBUser,
      participantB,
      virtualOpenThread,
      now,
      tx,
    );

    return decision.canSendMessage;
  }
}

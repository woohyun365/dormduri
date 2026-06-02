import { Inject, Injectable } from '@nestjs/common';
import type {
  ConversationThreadDetailResponse,
  ConversationThreadEntryResponse,
  ConversationThreadListResponse,
  ChatRealtimeReplayResponse,
  LeaveConversationThreadResponse,
  ListConversationThreadsQuery,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  UpdateChatReadMarkerRequest,
} from '@repo/shared/chat-contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../../auth/auth-session.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  CHAT_THREAD_NOTIFICATION_WRITER,
  type ChatThreadNotificationWriter,
} from '../../notifications/notifications.tokens.js';
import { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import { SeasonsService } from '../../seasons/seasons.service.js';
import {
  formatKstDate,
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
} from '../../seasons/season.utils.js';
import { createChatCommandService } from './chat-command.service.js';
import { createChatUserContextService } from './chat-user-context.service.js';
import { chatErrors } from '../errors/chat.errors.js';
import { createChatLifecycleOwner } from '../lifecycle/chat-lifecycle.service.js';
import { createChatMatchEventOwner } from '../lifecycle/chat-match-event.service.js';
import { toChatMessage, toChatThreadSummary } from '../mappers/chat-thread-presenter.js';
import { createChatThreadQueryService } from '../queries/chat-thread-query.service.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';
import {
  buildChatThreadListCursorBoundary,
  type ChatThreadListCursorBoundary,
  createChatThreadListCursorOwner,
} from '../queries/chat-thread-list-cursor.js';
import { createChatThreadSupportOwner } from '../policies/chat-thread-policy.js';
import { ChatRealtimeReplayService } from '../outbox/chat-realtime-replay.service.js';
import {
  type ChatRealtimeEventType,
  toChatRealtimeEventEnvelope,
} from '../events/chat-realtime-event.mapper.js';
import {
  acquireConversationThreadLeaveLock,
  acquireConversationThreadPairLock,
  acquireConversationThreadParticipantLocks,
} from '../persistence/chat-advisory-locks.js';

const noopChatThreadNotificationWriter: ChatThreadNotificationWriter = {
  appendChatThreadCreated() {
    return Promise.resolve({ notificationId: '', created: false });
  },
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(CHAT_THREAD_NOTIFICATION_WRITER)
    private readonly chatThreadNotificationWriter: ChatThreadNotificationWriter = noopChatThreadNotificationWriter,
  ) {}

  private get contextOwner() {
    return createChatUserContextService({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
    });
  }

  private get queryOwner() {
    return createChatThreadQueryService(this.prisma);
  }

  private get threadSupportOwner() {
    return createChatThreadSupportOwner({
      prisma: this.prisma,
      seasonParticipantsService: this.seasonParticipantsService,
    });
  }

  private get lifecycleOwner() {
    return createChatLifecycleOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      findThreadRoomSelectionDate: (thread) =>
        this.threadSupportOwner.findThreadRoomSelectionDate(thread),
    });
  }

  private get commandCluster() {
    return createChatCommandService({
      getDatabaseNow: () => this.prisma.getDatabaseNow(),
      runSerializableTransaction: <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) =>
        this.prisma.runSerializableTransaction(callback),
      getCurrentChatContext: (userId, now) => this.contextOwner.getCurrentChatContext(userId, now),
      getChatUserProjection: (userId, client) =>
        this.contextOwner.getChatUserProjection(userId, client),
      getValidatedTargetUser: (targetUserId, viewerUser, client) =>
        this.contextOwner.getValidatedTargetUser(targetUserId, viewerUser, client),
      getRequiredParticipant: (targetUser, seasonId, client) =>
        this.contextOwner.getRequiredParticipant(targetUser, seasonId, client),
      findCurrentSeasonParticipant: (userId, seasonId, client) =>
        this.seasonParticipantsService.findCurrentSeasonParticipant(userId, seasonId, client),
      selectCanonicalSelection: (participant) =>
        this.seasonParticipantsService.selectCanonicalSelection(participant),
      findThreadByPair: (seasonId, leftParticipantId, rightParticipantId, client) =>
        this.queryOwner.findThreadByPair(seasonId, leftParticipantId, rightParticipantId, client),
      synchronizeThreadLifecycle: (thread, now, client) =>
        this.lifecycleOwner.synchronizeThreadLifecycle(thread, now, client),
      canSendMessageToPair: (viewerContext, targetUser, targetParticipant, thread, now, client) =>
        this.threadSupportOwner.canSendMessageToPair(
          viewerContext,
          targetUser,
          targetParticipant,
          thread,
          now,
          client,
        ),
      toThreadSummary: (thread, viewerParticipantId, sendMessageDecision) =>
        toChatThreadSummary(thread, viewerParticipantId, sendMessageDecision),
      toMessage: (message) => toChatMessage(message),
      resolveViewerParticipantId: (thread, viewerUserId) =>
        this.threadSupportOwner.resolveViewerParticipantId(thread, viewerUserId),
      acquireConversationThreadPairLock,
      acquireConversationThreadParticipantLocks,
      acquireConversationThreadLeaveLock,
      findLeavableThread: (userId, threadId) =>
        this.queryOwner.findLeavableThread(userId, threadId),
      appendChatThreadCreatedNotification: (tx, input) =>
        this.chatThreadNotificationWriter.appendChatThreadCreated(tx, input),
    });
  }

  private get matchEventOwner() {
    return createChatMatchEventOwner({
      findThreadRoomSelectionDate: (thread) =>
        this.threadSupportOwner.findThreadRoomSelectionDate(thread),
      formatKstDate,
      canReopenDirectThreadAfterUnmatch: (tx, thread, now) =>
        this.canReopenDirectThreadAfterUnmatch(tx, thread, now),
    });
  }

  private get realtimeReplayService() {
    return new ChatRealtimeReplayService({ replayWindowDays: 7 });
  }

  private get threadListCursorOwner() {
    return createChatThreadListCursorOwner();
  }

  async getThreadEntry(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
  ): Promise<ConversationThreadEntryResponse> {
    const now = await this.prisma.getDatabaseNow();
    const viewerContext = await this.contextOwner.getCurrentChatContext(authUser.id, now);

    if (!viewerContext?.seasonContext || !viewerContext.participant) {
      return {
        targetUserId,
        thread: null,
        canEnterChatUi: false,
        canSendMessage: false,
      };
    }

    const targetUser = await this.contextOwner.getValidatedTargetUser(
      targetUserId,
      viewerContext.user,
    );
    const targetParticipant = await this.contextOwner.getRequiredParticipant(
      targetUser,
      viewerContext.seasonContext.season.id,
    );
    const existingThread = await this.queryOwner.findThreadByPair(
      viewerContext.seasonContext.season.id,
      viewerContext.participant.id,
      targetParticipant.id,
    );
    const synchronizedThread = existingThread
      ? await this.lifecycleOwner.resolveThreadLifecycleSnapshot(existingThread, now)
      : null;
    const sendMessageDecision = await this.threadSupportOwner.canSendMessageToPair(
      viewerContext,
      targetUser,
      targetParticipant,
      synchronizedThread,
      now,
    );

    const viewerMemberState = synchronizedThread
      ? (this.threadSupportOwner.getThreadMember(synchronizedThread, viewerContext.participant.id)
          ?.memberState ?? null)
      : null;
    const visibleThread =
      synchronizedThread &&
      viewerMemberState === 'ACTIVE' &&
      synchronizedThread.status !== 'ARCHIVED'
        ? synchronizedThread
        : null;

    return {
      targetUserId,
      thread: visibleThread
        ? toChatThreadSummary(visibleThread, viewerContext.participant.id, sendMessageDecision)
        : null,
      canEnterChatUi: visibleThread !== null || sendMessageDecision.canSendMessage,
      canSendMessage: sendMessageDecision.canSendMessage,
    };
  }

  async listThreads(
    authUser: AuthenticatedUserContext,
    input: ListConversationThreadsQuery = {},
  ): Promise<ConversationThreadListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const limit = input.limit ?? 20;
    let after: ChatThreadListCursorBoundary | null = null;
    if (input.cursor) {
      try {
        after = this.threadListCursorOwner.verifyCursor({
          cursor: input.cursor,
          viewerUserId: authUser.id,
          now,
        });
      } catch {
        throw chatErrors.invalidThreadListCursor();
      }
    }
    const threads = await this.queryOwner.findThreadsForViewer(authUser.id, { limit, after });

    const items = [];
    for (const thread of threads.items) {
      const synchronized = await this.lifecycleOwner.resolveThreadLifecycleSnapshot(thread, now);
      if (synchronized.status === 'ARCHIVED') {
        continue;
      }
      const viewerParticipantId = this.threadSupportOwner.resolveViewerParticipantId(
        synchronized,
        authUser.id,
      );
      items.push(
        toChatThreadSummary(
          synchronized,
          viewerParticipantId,
          this.threadSupportOwner.resolveThreadSummarySendMessageDecision(
            synchronized,
            viewerParticipantId,
            now,
          ),
        ),
      );
    }

    const lastThread = threads.items.at(-1) ?? null;
    const nextCursor =
      threads.hasNextPage && lastThread
        ? this.threadListCursorOwner.signCursor({
            viewerUserId: authUser.id,
            after: buildChatThreadListCursorBoundary(lastThread),
            now,
          })
        : null;

    return {
      items,
      pageInfo: {
        hasNextPage: nextCursor !== null,
        nextCursor,
      },
    };
  }

  async getThreadDetail(
    authUser: AuthenticatedUserContext,
    threadId: string,
  ): Promise<ConversationThreadDetailResponse> {
    const now = await this.prisma.getDatabaseNow();
    const thread = await this.queryOwner.findThreadDetailForViewer(authUser.id, threadId);

    if (!thread || !this.threadSupportOwner.isViewerInThread(thread, authUser.id)) {
      throw chatErrors.threadNotFound();
    }

    const synchronized = await this.lifecycleOwner.resolveThreadLifecycleSnapshot(thread, now);
    if (synchronized.status === 'ARCHIVED') {
      throw chatErrors.threadNotFound();
    }

    const viewerParticipantId = this.threadSupportOwner.resolveViewerParticipantId(
      synchronized,
      authUser.id,
    );

    const viewerMember = this.threadSupportOwner.getThreadMember(synchronized, viewerParticipantId);
    const lastVisibleAt = viewerMember?.lastVisibleAt ?? null;
    const visibleMessages = lastVisibleAt
      ? synchronized.messages.filter((message) => message.sentAt >= lastVisibleAt)
      : synchronized.messages;

    return {
      thread: toChatThreadSummary(
        synchronized,
        viewerParticipantId,
        this.threadSupportOwner.resolveThreadSummarySendMessageDecision(
          synchronized,
          viewerParticipantId,
          now,
        ),
      ),
      messages: visibleMessages.map((message) => toChatMessage(message)),
    };
  }

  async sendMessage(
    authUser: AuthenticatedUserContext,
    input: SendConversationMessageRequest,
  ): Promise<SendConversationMessageResponse> {
    return this.commandCluster.sendMessage(authUser, input);
  }

  async updateReadMarker(
    authUser: AuthenticatedUserContext,
    threadId: string,
    input: UpdateChatReadMarkerRequest,
  ) {
    return this.commandCluster.updateReadMarker(authUser, threadId, input);
  }

  async replayRealtimeEvents(
    authUser: AuthenticatedUserContext,
    input: { after?: string | null; limit?: number | null },
  ): Promise<ChatRealtimeReplayResponse> {
    const now = await this.prisma.getDatabaseNow();
    const replayResult = await this.realtimeReplayService.getReplayEvents(this.prisma, {
      userId: authUser.id,
      after: input.after ?? null,
      limit: input.limit ?? 100,
      now,
    });

    if (replayResult.status === 'resync_required') {
      return {
        ok: false,
        reason: replayResult.reason,
        resyncRequired: true,
      };
    }

    try {
      return {
        ok: true,
        events: replayResult.events.map((event) => {
          if (event.schemaVersion !== 1) {
            throw new Error('[chat-service] unsupported realtime event schema version');
          }

          return toChatRealtimeEventEnvelope({
            schemaVersion: 1,
            eventId: event.eventId,
            eventType: event.eventType as ChatRealtimeEventType,
            occurredAt: new Date(event.occurredAt),
            cursor: event.cursor,
            threadId: event.threadId,
            payload: event.payload,
          });
        }),
        nextCursor: replayResult.nextCursor,
        hasMore: replayResult.hasMore,
      };
    } catch {
      return {
        ok: false,
        reason: 'SCHEMA_UNSUPPORTED',
        resyncRequired: true,
      };
    }
  }

  async canSubscribeThread(authUser: AuthenticatedUserContext, threadId: string): Promise<boolean> {
    return this.queryOwner.canSubscribeThreadForViewer(authUser.id, threadId);
  }

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
    return this.matchEventOwner.handleActiveMatchCreated(tx, input, now);
  }

  async handleActiveMatchUnmatched(
    tx: Prisma.TransactionClient,
    input: {
      activeMatchId: string;
    },
    now: Date,
  ) {
    return this.matchEventOwner.handleActiveMatchUnmatched(tx, input, now);
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

  async sweepThreadLifecycle(now: Date) {
    return this.lifecycleOwner.sweepThreadLifecycle(now);
  }

  async leaveThread(
    authUser: AuthenticatedUserContext,
    threadId: string,
  ): Promise<LeaveConversationThreadResponse> {
    return this.commandCluster.leaveThread(authUser, threadId);
  }
}

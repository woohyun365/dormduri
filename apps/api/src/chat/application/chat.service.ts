import { Inject, Injectable } from '@nestjs/common';
import type {
  ConversationThreadDetailResponse,
  ConversationThreadEntryResponse,
  ConversationThreadListResponse,
  ConversationStatsResponse,
  ChatRealtimeReplayResponse,
  LeaveConversationThreadResponse,
  ListConversationThreadsQuery,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  UpdateChatReadMarkerRequest,
} from '@repo/shared/chat-contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  CHAT_THREAD_NOTIFICATION_WRITER,
  type ChatThreadNotificationWriter,
} from '../../notifications/notifications.tokens.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import { SeasonsService } from '../../seasons/seasons.service.js';
import { createChatCommandService } from './chat-command.service.js';
import { createChatUserContextService } from './chat-user-context.service.js';
import { chatErrors } from '../errors/chat.errors.js';
import { ChatSeasonLifecycleService } from '../lifecycle/chat-season-lifecycle.service.js';
import { toChatMessage, toChatThreadSummary } from '../mappers/chat-thread-presenter.js';
import { createChatThreadQueryService } from '../queries/chat-thread-query.service.js';
import {
  buildChatThreadListCursorBoundary,
  type ChatThreadListCursorBoundary,
  createChatThreadListCursorOwner,
} from '../queries/chat-thread-list-cursor.js';
import { createChatThreadSupportOwner } from '../policies/chat-thread-policy.js';
import { createChatPairEntryQuery } from '../pairs/chat-pair-entry.query.js';
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
    private readonly chatSeasonLifecycle: ChatSeasonLifecycleService,
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

  private get pairEntryQuery() {
    return createChatPairEntryQuery({
      getDatabaseNow: () => this.prisma.getDatabaseNow(),
      getCurrentChatContext: (userId, now) => this.contextOwner.getCurrentChatContext(userId, now),
      getValidatedTargetUser: (targetUserId, viewerUser) =>
        this.contextOwner.getValidatedTargetUser(targetUserId, viewerUser),
      getRequiredParticipant: (targetUser, seasonId) =>
        this.contextOwner.getRequiredParticipant(targetUser, seasonId),
      findThreadByPair: (seasonId, leftParticipantId, rightParticipantId) =>
        this.queryOwner.findThreadByPair(seasonId, leftParticipantId, rightParticipantId),
      resolveThreadLifecycleSnapshot: (thread, now) =>
        this.chatSeasonLifecycle.resolveThreadLifecycleSnapshot(thread, now),
      canSendMessageToPair: (viewerContext, targetUser, targetParticipant, thread, now) =>
        this.threadSupportOwner.canSendMessageToPair(
          viewerContext,
          targetUser,
          targetParticipant,
          thread,
          now,
        ),
      getThreadMember: (thread, viewerParticipantId) =>
        this.threadSupportOwner.getThreadMember(thread, viewerParticipantId),
      toThreadSummary: (thread, viewerParticipantId, sendMessageDecision) =>
        toChatThreadSummary(thread, viewerParticipantId, sendMessageDecision),
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
        this.chatSeasonLifecycle.synchronizeThreadLifecycle(thread, now, client),
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
    return this.pairEntryQuery.getThreadEntry(authUser, targetUserId);
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
      const synchronized = await this.chatSeasonLifecycle.resolveThreadLifecycleSnapshot(
        thread,
        now,
      );
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

  async getConversationStats(
    authUser: AuthenticatedUserContext,
  ): Promise<ConversationStatsResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      select: { campus: true },
    });
    if (!user) {
      return { current: null, past: [] };
    }

    const currentSeasonContext = await this.seasonsService.getCurrentSeasonContext(
      user.campus,
      now,
    );

    return this.queryOwner.getConversationStatsForUser({
      userId: authUser.id,
      currentSeason: currentSeasonContext
        ? {
            id: currentSeasonContext.season.id,
            name: currentSeasonContext.season.name,
          }
        : null,
    });
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

    const synchronized = await this.chatSeasonLifecycle.resolveThreadLifecycleSnapshot(thread, now);
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

  async leaveThread(
    authUser: AuthenticatedUserContext,
    threadId: string,
  ): Promise<LeaveConversationThreadResponse> {
    return this.commandCluster.leaveThread(authUser, threadId);
  }
}

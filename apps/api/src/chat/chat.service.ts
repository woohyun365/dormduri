import { Injectable } from '@nestjs/common';
import type {
  ConversationMessage,
  ConversationThreadDetailResponse,
  ConversationThreadEntryResponse,
  ConversationThreadListResponse,
  ConversationThreadSummary,
  LeaveConversationThreadResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
} from '@repo/shared/chat-contract';
import { Prisma } from '../generated/prisma/client.js';
import type { DormitorySelectionState } from '../generated/prisma/enums.js';
import { acquireTransactionAdvisoryLock } from '../generated/prisma/sql.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  hasParticipantProfile,
  hasOperatedAssignedDormitory,
  isParticipantRegistered,
  isVisibleRegisteredParticipant,
  resolvePublicExposure,
} from '../season-participants/season-participant-policy.js';
import {
  SeasonParticipantsService,
  type CurrentSeasonParticipantRecord,
  type ParticipantBackfillSeed,
} from '../season-participants/season-participants.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import {
  formatKstDate,
  getEffectiveSeasonState,
  normalizeSeasonRuntimeRow,
} from '../seasons/season.utils.js';
import { buildParticipantPairIdentity } from '../matches/match.utils.js';
import { chatErrors } from './chat.errors.js';

const threadSelect = {
  id: true,
  seasonId: true,
  pairKey: true,
  participantAId: true,
  participantBId: true,
  openedByParticipantId: true,
  threadKind: true,
  activeMatchId: true,
  status: true,
  closedReason: true,
  closedAt: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      campusCode: true,
      name: true,
      preparationStartDate: true,
      matchingStartDate: true,
      seasonEndDate: true,
      overrideState: true,
      overrideReason: true,
      overrideStartedAt: true,
      overrideEndsAt: true,
      dormitoryOperations: {
        select: {
          dormitoryId: true,
          isOperated: true,
          roomSelectionDate: true,
        },
      },
    },
  },
  participantA: {
    select: {
      id: true,
      userId: true,
      dormitoryId: true,
      dormitorySelectionState: true,
    },
  },
  participantB: {
    select: {
      id: true,
      userId: true,
      dormitoryId: true,
      dormitorySelectionState: true,
    },
  },
  activeMatch: {
    select: {
      id: true,
      participantAId: true,
      participantBId: true,
      createdFromRequestId: true,
      startedAt: true,
      endedAt: true,
    },
  },
  members: {
    select: {
      participantId: true,
      memberState: true,
      leftAt: true,
      lastVisibleAt: true,
    },
  },
  messages: {
    orderBy: [{ sentAt: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      body: true,
      sentAt: true,
      senderParticipant: {
        select: {
          userId: true,
        },
      },
    },
  },
} satisfies Prisma.ConversationThreadSelect;

type ThreadRecord = Prisma.ConversationThreadGetPayload<{ select: typeof threadSelect }>;

type ChatUserSeed = ParticipantBackfillSeed & {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  dormitorySelectionState: DormitorySelectionState;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

  async getThreadEntry(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
  ): Promise<ConversationThreadEntryResponse> {
    const now = await this.prisma.getDatabaseNow();
    const viewerContext = await this.getCurrentChatContext(authUser.id, now);

    if (!viewerContext?.seasonContext || !viewerContext.participant) {
      return {
        targetUserId,
        thread: null,
        canEnterChatUi: false,
        canSendMessage: false,
      };
    }

    const targetUser = await this.getValidatedTargetUser(targetUserId, viewerContext.user);
    const targetParticipant = await this.getRequiredParticipant(targetUser, now);
    const existingThread = await this.findThreadByPair(
      viewerContext.seasonContext.season.id,
      viewerContext.participant.id,
      targetParticipant.id,
    );
    const synchronizedThread = existingThread
      ? await this.synchronizeThreadLifecycle(existingThread, now)
      : null;
    const canSendMessage = await this.canSendMessageToPair(
      viewerContext,
      targetUser,
      targetParticipant,
      synchronizedThread,
      now,
    );

    const viewerMemberState = synchronizedThread
      ? (this.getThreadMember(synchronizedThread, viewerContext.participant.id)?.memberState ??
        null)
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
        ? this.toThreadSummary(visibleThread, viewerContext.participant.id, canSendMessage)
        : null,
      canEnterChatUi: visibleThread !== null || canSendMessage,
      canSendMessage,
    };
  }

  async listThreads(authUser: AuthenticatedUserContext): Promise<ConversationThreadListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const threads = await this.prisma.conversationThread.findMany({
      where: {
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            participant: { userId: authUser.id },
            memberState: 'ACTIVE',
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: threadSelect,
    });

    const items: ConversationThreadSummary[] = [];
    for (const thread of threads) {
      const synchronized = await this.synchronizeThreadLifecycle(thread, now);
      if (synchronized.status === 'ARCHIVED') {
        continue;
      }
      const viewerParticipantId = this.resolveViewerParticipantId(synchronized, authUser.id);
      items.push(
        this.toThreadSummary(
          synchronized,
          viewerParticipantId,
          this.isThreadWritable(synchronized, viewerParticipantId, now),
        ),
      );
    }

    return { items };
  }

  async getThreadDetail(
    authUser: AuthenticatedUserContext,
    threadId: string,
  ): Promise<ConversationThreadDetailResponse> {
    const now = await this.prisma.getDatabaseNow();
    const thread = await this.prisma.conversationThread.findFirst({
      where: {
        id: threadId,
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            participant: { userId: authUser.id },
            memberState: 'ACTIVE',
          },
        },
      },
      select: threadSelect,
    });

    if (!thread || !this.isViewerInThread(thread, authUser.id)) {
      throw chatErrors.threadNotFound();
    }

    const synchronized = await this.synchronizeThreadLifecycle(thread, now);
    const viewerParticipantId = this.resolveViewerParticipantId(synchronized, authUser.id);

    const viewerMember = this.getThreadMember(synchronized, viewerParticipantId);
    const visibleMessages = viewerMember?.lastVisibleAt
      ? synchronized.messages.filter((message) => message.sentAt >= viewerMember.lastVisibleAt!)
      : synchronized.messages;

    return {
      thread: this.toThreadSummary(
        synchronized,
        viewerParticipantId,
        this.isThreadWritable(synchronized, viewerParticipantId, now),
      ),
      messages: visibleMessages.map((message) => this.toMessage(message)),
    };
  }

  async sendMessage(
    authUser: AuthenticatedUserContext,
    input: SendConversationMessageRequest,
  ): Promise<SendConversationMessageResponse> {
    const now = await this.prisma.getDatabaseNow();
    const viewerContext = await this.getCurrentChatContext(authUser.id, now);

    if (!viewerContext?.seasonContext || !viewerContext.participant) {
      throw chatErrors.messageSendNotAllowed();
    }

    const targetUser = await this.getValidatedTargetUser(input.targetUserId, viewerContext.user);
    const targetParticipant = await this.getRequiredParticipant(targetUser, now);
    const pairIdentity = buildParticipantPairIdentity(
      viewerContext.participant.id,
      targetParticipant.id,
    );

    return this.prisma.runSerializableTransaction(async (tx) => {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock(
          'conversation_thread_pair',
          `${viewerContext.seasonContext!.season.id}:${pairIdentity.pairKey}`,
        ),
      );

      const existingThread = await tx.conversationThread.findFirst({
        where: {
          seasonId: viewerContext.seasonContext!.season.id,
          pairKey: pairIdentity.pairKey,
          status: { in: ['OPEN', 'READ_ONLY'] },
        },
        select: threadSelect,
      });
      const synchronizedThread = existingThread
        ? await this.synchronizeThreadLifecycle(existingThread, now, tx)
        : null;
      const canSend = await this.canSendMessageToPair(
        viewerContext,
        targetUser,
        targetParticipant,
        synchronizedThread,
        now,
        tx,
      );

      if (!canSend) {
        throw chatErrors.messageSendNotAllowed();
      }

      const pairActiveMatch = await tx.activeMatch.findFirst({
        where: {
          seasonId: viewerContext.seasonContext!.season.id,
          endedAt: null,
          pairKey: pairIdentity.pairKey,
        },
        select: {
          id: true,
          participantAId: true,
          participantBId: true,
          createdFromRequestId: true,
          startedAt: true,
          endedAt: true,
        },
      });

      let thread: ThreadRecord;
      let createdThread = false;

      if (!synchronizedThread) {
        thread = await tx.conversationThread.create({
          data: {
            seasonId: viewerContext.seasonContext!.season.id,
            pairKey: pairIdentity.pairKey,
            participantAId: pairIdentity.pairMinParticipantId,
            participantBId: pairIdentity.pairMaxParticipantId,
            openedByParticipantId: viewerContext.participant!.id,
            threadKind: pairActiveMatch ? 'MATCHED' : 'DIRECT',
            activeMatchId: pairActiveMatch?.id ?? null,
            status: 'OPEN',
          },
          select: threadSelect,
        });
        await tx.conversationThreadMember.createMany({
          data: [
            { threadId: thread.id, participantId: pairIdentity.pairMinParticipantId },
            { threadId: thread.id, participantId: pairIdentity.pairMaxParticipantId },
          ],
          skipDuplicates: true,
        });
        createdThread = true;
      } else {
        thread = synchronizedThread;
      }

      if (pairActiveMatch && thread.threadKind !== 'MATCHED') {
        thread = await tx.conversationThread.update({
          where: { id: thread.id },
          data: {
            threadKind: 'MATCHED',
            activeMatchId: pairActiveMatch.id,
            status: 'OPEN',
            closedReason: null,
            closedAt: null,
          },
          select: threadSelect,
        });
      }

      await tx.conversationThreadMember.updateMany({
        where: {
          threadId: thread.id,
          participantId: { in: [viewerContext.participant!.id, targetParticipant.id] },
          memberState: 'LEFT',
        },
        data: {
          memberState: 'ACTIVE',
          leftAt: null,
          lastVisibleAt: now,
        },
      });

      const message = await tx.conversationMessage.create({
        data: {
          threadId: thread.id,
          senderParticipantId: viewerContext.participant!.id,
          body: input.body,
          sentAt: now,
        },
        select: {
          id: true,
          body: true,
          sentAt: true,
          senderParticipant: {
            select: {
              userId: true,
            },
          },
        },
      });

      thread = await tx.conversationThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: now },
        select: threadSelect,
      });

      return {
        thread: this.toThreadSummary(thread, viewerContext.participant!.id, true),
        message: this.toMessage(message),
        createdThread,
      };
    });
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
  }

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

    const roomSelectionDate = this.findThreadRoomSelectionDate(matchedThread);
    const shouldRemainOpen = roomSelectionDate ? formatKstDate(now) <= roomSelectionDate : false;
    const nextStatus =
      matchedThread.status === 'READ_ONLY' ? 'READ_ONLY' : shouldRemainOpen ? 'OPEN' : 'READ_ONLY';
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
  }

  private async getCurrentChatContext(userId: string, now: Date) {
    const user = await this.getUserSeed(userId);
    if (!user) {
      throw new Error('[ChatService] authenticated user not found');
    }

    const seasonContext = await this.seasonsService.getCurrentSeasonContext(user.campus, now);
    const participant = user.emailVerifiedAt
      ? await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now)
      : null;
    const selection = this.seasonParticipantsService.selectCanonicalSelection(user, participant);

    return {
      user,
      seasonContext,
      participant,
      selection,
    };
  }

  private async getUserSeed(userId: string): Promise<ChatUserSeed | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerifiedAt: true,
        gender: true,
        campus: true,
        dormitoryId: true,
        dormitorySelectionState: true,
      },
    });
  }

  private async getValidatedTargetUser(targetUserId: string, viewerUser: ChatUserSeed) {
    const targetUser = await this.getUserSeed(targetUserId);
    if (!targetUser || targetUser.id === viewerUser.id) {
      throw chatErrors.threadTargetNotFound();
    }
    if (targetUser.campus !== viewerUser.campus || targetUser.gender !== viewerUser.gender) {
      throw chatErrors.threadTargetNotFound();
    }

    return targetUser;
  }

  private async getRequiredParticipant(targetUser: ChatUserSeed, now: Date) {
    const participant = await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(
      targetUser,
      now,
    );
    if (!participant) {
      throw chatErrors.threadTargetNotFound();
    }

    return participant;
  }

  private async canSendMessageToPair(
    viewerContext: Awaited<ReturnType<ChatService['getCurrentChatContext']>>,
    targetUser: ChatUserSeed,
    targetParticipant: CurrentSeasonParticipantRecord,
    thread: ThreadRecord | null,
    now: Date,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const seasonContext = viewerContext.seasonContext;
    const viewerParticipant = viewerContext.participant;
    if (!seasonContext || !viewerParticipant) {
      return false;
    }

    if (thread) {
      const viewerMember = this.getThreadMember(thread, viewerParticipant.id);
      if (viewerMember?.memberState === 'ACTIVE') {
        return this.isThreadWritable(thread, viewerParticipant.id, now);
      }

      if (viewerMember?.memberState === 'LEFT') {
        return thread.status === 'OPEN';
      }
    }

    const targetSelection = this.seasonParticipantsService.selectCanonicalSelection(
      targetUser,
      targetParticipant,
    );
    const viewerPairActiveMatch = await client.activeMatch.findFirst({
      where: {
        seasonId: seasonContext.season.id,
        endedAt: null,
        OR: [{ participantAId: viewerParticipant.id }, { participantBId: viewerParticipant.id }],
      },
      select: {
        id: true,
        participantAId: true,
        participantBId: true,
      },
    });
    const targetPairActiveMatch = await client.activeMatch.findFirst({
      where: {
        seasonId: seasonContext.season.id,
        endedAt: null,
        OR: [{ participantAId: targetParticipant.id }, { participantBId: targetParticipant.id }],
      },
      select: {
        id: true,
        participantAId: true,
        participantBId: true,
      },
    });
    const matchedPartnerParticipantId = viewerPairActiveMatch
      ? viewerPairActiveMatch.participantAId === viewerParticipant.id
        ? viewerPairActiveMatch.participantBId
        : viewerPairActiveMatch.participantAId
      : null;
    const operatedDormitoryIds = new Set(
      seasonContext.operatedDormitories.map((item) => item.dormitoryId),
    );
    const canStartChat = buildCurrentUserCapabilities({
      campusOperated: true,
      seasonState: seasonContext.state,
      participantRegistered: isParticipantRegistered(viewerParticipant),
      participantMatched: viewerPairActiveMatch !== null,
      selectionState: viewerContext.selection.dormitorySelectionState,
      hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
        operatedDormitoryIds,
        viewerContext.selection.dormitorySelectionState,
        viewerContext.selection.dormitoryId,
      ),
      nicknameLockedBySeason: false,
      nicknameCooldownActive: false,
      hasSelectableDormitories: seasonContext.operatedDormitories.length > 0,
      currentDormitoryCanMatch: canCurrentDormitoryMatch(
        seasonContext,
        viewerContext.selection.dormitoryId,
        now,
      ),
    }).canStartChat;
    const exposure = resolvePublicExposure(
      {
        campusOperated: true,
        seasonState: seasonContext.state,
        registered: isParticipantRegistered(viewerParticipant),
        matched: viewerPairActiveMatch !== null,
        matchedPartnerParticipantId,
        selectionState: viewerContext.selection.dormitorySelectionState,
        dormitoryId: viewerContext.selection.dormitoryId,
        hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
          operatedDormitoryIds,
          viewerContext.selection.dormitorySelectionState,
          viewerContext.selection.dormitoryId,
        ),
        currentDormitoryCanMatch: canCurrentDormitoryMatch(
          seasonContext,
          viewerContext.selection.dormitoryId,
          now,
        ),
      },
      {
        participantId: targetParticipant.id,
        visible: isVisibleRegisteredParticipant(targetParticipant),
        registered: isParticipantRegistered(targetParticipant),
        matched: targetPairActiveMatch !== null,
        selectionState: targetSelection.dormitorySelectionState,
        dormitoryId: targetSelection.dormitoryId,
        hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
          operatedDormitoryIds,
          targetSelection.dormitorySelectionState,
          targetSelection.dormitoryId,
        ),
        hasSeasonProfile: hasParticipantProfile(targetParticipant),
      },
    );

    return canStartChat && exposure.exposureLevel === 'FULL';
  }

  private async synchronizeThreadLifecycle(
    thread: ThreadRecord,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<ThreadRecord> {
    const client = tx ?? this.prisma;
    const today = formatKstDate(now);
    const currentSeasonContext = await this.seasonsService.getCurrentSeasonContext(
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
      const roomSelectionDate = this.findThreadRoomSelectionDate(thread);
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
  }

  async leaveThread(
    authUser: AuthenticatedUserContext,
    threadId: string,
  ): Promise<LeaveConversationThreadResponse> {
    const now = await this.prisma.getDatabaseNow();
    const thread = await this.prisma.conversationThread.findFirst({
      where: {
        id: threadId,
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            participant: { userId: authUser.id },
            memberState: 'ACTIVE',
          },
        },
      },
      select: threadSelect,
    });

    if (!thread) {
      throw chatErrors.threadLeaveNotAllowed();
    }

    const viewerParticipantId = this.resolveViewerParticipantId(thread, authUser.id);

    return this.prisma.runSerializableTransaction(async (tx) => {
      await tx.conversationThreadMember.update({
        where: {
          threadId_participantId: {
            threadId: thread.id,
            participantId: viewerParticipantId,
          },
        },
        data: {
          memberState: 'LEFT',
          leftAt: now,
        },
      });

      const remainingActiveMembers = await tx.conversationThreadMember.count({
        where: {
          threadId: thread.id,
          memberState: 'ACTIVE',
        },
      });

      if (remainingActiveMembers === 0) {
        await tx.conversationThread.update({
          where: { id: thread.id },
          data: {
            status: 'ARCHIVED',
            closedAt: thread.closedAt ?? now,
          },
        });
        return { threadId: thread.id, archived: true };
      }

      return { threadId: thread.id, archived: false };
    });
  }

  private getThreadMember(thread: ThreadRecord, participantId: string) {
    return thread.members.find((member) => member.participantId === participantId) ?? null;
  }

  private resolveThreadSeasonState(thread: ThreadRecord, now: Date) {
    return getEffectiveSeasonState(normalizeSeasonRuntimeRow(thread.season), now);
  }

  private findThreadRoomSelectionDate(thread: ThreadRecord) {
    const dormitoryId = thread.participantA.dormitoryId ?? thread.participantB.dormitoryId;
    const operation = thread.season.dormitoryOperations.find(
      (item) => item.dormitoryId === dormitoryId,
    );
    return operation ? formatKstDate(operation.roomSelectionDate) : null;
  }

  private isViewerInThread(thread: ThreadRecord, userId: string) {
    return thread.participantA.userId === userId || thread.participantB.userId === userId;
  }

  private resolveViewerParticipantId(thread: ThreadRecord, viewerUserId: string) {
    if (thread.participantA.userId === viewerUserId) {
      return thread.participantAId;
    }
    if (thread.participantB.userId === viewerUserId) {
      return thread.participantBId;
    }
    throw chatErrors.threadNotFound();
  }

  private isThreadWritable(thread: ThreadRecord, viewerParticipantId: string, now: Date) {
    if (thread.status !== 'OPEN') {
      return false;
    }
    if (!this.isThreadParticipant(thread, viewerParticipantId)) {
      return false;
    }

    if (thread.threadKind === 'MATCHED') {
      const state = this.resolveThreadSeasonState(thread, now);
      return state === 'SEASON_MATCHING' || state === 'SEASON_POST_MATCH';
    }

    const roomSelectionDate = this.findThreadRoomSelectionDate(thread);
    return roomSelectionDate ? formatKstDate(now) <= roomSelectionDate : false;
  }

  private isThreadParticipant(thread: ThreadRecord, participantId: string) {
    return thread.participantAId === participantId || thread.participantBId === participantId;
  }

  private toThreadSummary(
    thread: ThreadRecord,
    viewerParticipantId: string,
    canSendMessage: boolean,
  ): ConversationThreadSummary {
    const viewerIsParticipantA = thread.participantAId === viewerParticipantId;

    return {
      id: thread.id,
      seasonId: thread.seasonId,
      counterpartUserId: viewerIsParticipantA
        ? thread.participantB.userId
        : thread.participantA.userId,
      counterpartParticipantId: viewerIsParticipantA
        ? thread.participantBId
        : thread.participantAId,
      threadKind: thread.threadKind,
      status: thread.status,
      closedReason: thread.closedReason,
      closedAt: thread.closedAt?.toISOString() ?? null,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      canSendMessage,
      canReport: true,
    };
  }

  private toMessage(message: ThreadRecord['messages'][number]): ConversationMessage {
    return {
      id: message.id,
      senderUserId: message.senderParticipant.userId,
      body: message.body,
      sentAt: message.sentAt.toISOString(),
    };
  }

  private async findThreadByPair(
    seasonId: string,
    leftParticipantId: string,
    rightParticipantId: string,
  ) {
    const pairIdentity = buildParticipantPairIdentity(leftParticipantId, rightParticipantId);

    return this.prisma.conversationThread.findFirst({
      where: {
        seasonId,
        pairKey: pairIdentity.pairKey,
        status: { in: ['OPEN', 'READ_ONLY'] },
      },
      select: threadSelect,
    });
  }
}

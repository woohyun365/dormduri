import type {
  LeaveConversationThreadResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
} from '@repo/shared/chat-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { buildParticipantPairIdentity } from '../matches/match.utils.js';
import type { ChatUserContext } from './chat-context-owner.js';
import { chatErrors } from './chat.errors.js';
import type { ChatParticipantUserProjection, ThreadRecord } from './chat-selects.js';
import { threadSelect } from './chat-selects.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import type { ChatSendMessageDecision } from './chat-thread-support.js';

type ConversationMessageResponseRecord = {
  id: string;
  body: string;
  bodyState: 'PLAIN' | 'TOMBSTONED' | 'DISPOSED';
  tombstoneReason:
    | 'ACCOUNT_DELETION_RETENTION'
    | 'USER_MESSAGE_DELETED'
    | 'MODERATION_POLICY_VIOLATION'
    | 'ADMIN_ACTION'
    | 'RETENTION_DISPOSED'
    | null;
  bodyVersion: number;
  sentAt: Date;
  senderParticipant: {
    userId: string;
  };
};

interface ChatCommandClusterDeps {
  getDatabaseNow(): Promise<Date>;
  runSerializableTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  getCurrentChatContext(userId: string, now: Date): Promise<ChatUserContext | null>;
  getChatUserProjection(
    userId: string,
    client?: Prisma.TransactionClient,
  ): Promise<ChatParticipantUserProjection | null>;
  getValidatedTargetUser(
    targetUserId: string,
    viewerUser: ChatParticipantUserProjection,
    client?: Prisma.TransactionClient,
  ): Promise<ChatParticipantUserProjection>;
  getRequiredParticipant(
    targetUser: ChatParticipantUserProjection,
    seasonId: string,
    client?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord>;
  findCurrentSeasonParticipant(
    userId: string,
    seasonId: string,
    client?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null>;
  selectCanonicalSelection(
    participant: CurrentSeasonParticipantRecord | null,
  ): ChatUserContext['selection'];
  findThreadByPair(
    seasonId: string,
    leftParticipantId: string,
    rightParticipantId: string,
    client?: Prisma.TransactionClient,
  ): Promise<ThreadRecord | null>;
  synchronizeThreadLifecycle(
    thread: ThreadRecord,
    now: Date,
    client?: Prisma.TransactionClient,
  ): Promise<ThreadRecord>;
  canSendMessageToPair(
    viewerContext: ChatUserContext,
    targetUser: ChatParticipantUserProjection,
    targetParticipant: CurrentSeasonParticipantRecord,
    thread: ThreadRecord | null,
    now: Date,
    client?: Prisma.TransactionClient,
  ): Promise<ChatSendMessageDecision>;
  toThreadSummary(
    thread: ThreadRecord,
    viewerParticipantId: string,
    sendMessageDecision: ChatSendMessageDecision,
  ): SendConversationMessageResponse['thread'];
  toMessage(message: ConversationMessageResponseRecord): SendConversationMessageResponse['message'];
  resolveViewerParticipantId(thread: ThreadRecord, viewerUserId: string): string;
  acquireConversationThreadPairLock(
    tx: Prisma.TransactionClient,
    seasonId: string,
    pairKey: string,
  ): Promise<void>;
  acquireConversationThreadParticipantLocks(
    tx: Prisma.TransactionClient,
    seasonId: string,
    participantIds: readonly [string, string],
  ): Promise<void>;
  acquireConversationThreadLeaveLock(tx: Prisma.TransactionClient, threadId: string): Promise<void>;
  findLeavableThread(userId: string, threadId: string): Promise<ThreadRecord | null>;
}

export function createChatCommandCluster(deps: ChatCommandClusterDeps) {
  return {
    async sendMessage(
      authUser: AuthenticatedUserContext,
      input: SendConversationMessageRequest,
    ): Promise<SendConversationMessageResponse> {
      const now = await deps.getDatabaseNow();
      const viewerContext = await deps.getCurrentChatContext(authUser.id, now);

      if (!viewerContext?.seasonContext || !viewerContext.participant) {
        throw chatErrors.messageSendNotAllowed();
      }

      const targetUser = await deps.getValidatedTargetUser(input.targetUserId, viewerContext.user);
      const targetParticipant = await deps.getRequiredParticipant(
        targetUser,
        viewerContext.seasonContext.season.id,
      );
      const pairIdentity = buildParticipantPairIdentity(
        viewerContext.participant.id,
        targetParticipant.id,
      );

      return deps.runSerializableTransaction(async (tx) => {
        await deps.acquireConversationThreadPairLock(
          tx,
          viewerContext.seasonContext!.season.id,
          pairIdentity.pairKey,
        );

        await deps.acquireConversationThreadParticipantLocks(
          tx,
          viewerContext.seasonContext!.season.id,
          [pairIdentity.pairMinParticipantId, pairIdentity.pairMaxParticipantId],
        );

        const txViewerUser = await deps.getChatUserProjection(authUser.id, tx);
        if (!txViewerUser) {
          throw chatErrors.messageSendNotAllowed();
        }
        const txTargetUser = await deps.getChatUserProjection(input.targetUserId, tx);
        if (
          !txTargetUser ||
          txTargetUser.id === txViewerUser.id ||
          txTargetUser.campus !== txViewerUser.campus ||
          txTargetUser.gender !== txViewerUser.gender
        ) {
          throw chatErrors.messageSendNotAllowed();
        }
        const txViewerParticipant = await deps.findCurrentSeasonParticipant(
          txViewerUser.id,
          viewerContext.seasonContext!.season.id,
          tx,
        );
        const txTargetParticipant = await deps.findCurrentSeasonParticipant(
          txTargetUser.id,
          viewerContext.seasonContext!.season.id,
          tx,
        );

        if (!txViewerParticipant || !txTargetParticipant) {
          throw chatErrors.messageSendNotAllowed();
        }

        const txViewerContext: ChatUserContext = {
          ...viewerContext,
          user: txViewerUser,
          participant: txViewerParticipant,
          selection: deps.selectCanonicalSelection(txViewerParticipant),
        };

        const existingThread = await deps.findThreadByPair(
          viewerContext.seasonContext!.season.id,
          txViewerParticipant.id,
          txTargetParticipant.id,
          tx,
        );
        const synchronizedThread = existingThread
          ? await deps.synchronizeThreadLifecycle(existingThread, now, tx)
          : null;
        const sendMessageDecision = await deps.canSendMessageToPair(
          txViewerContext,
          txTargetUser,
          txTargetParticipant,
          synchronizedThread,
          now,
          tx,
        );

        if (!sendMessageDecision.canSendMessage) {
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
              openedByParticipantId: txViewerParticipant.id,
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
            participantId: { in: [txViewerParticipant.id, txTargetParticipant.id] },
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
            senderParticipantId: txViewerParticipant.id,
            body: input.body,
            sentAt: now,
          },
          select: {
            id: true,
            body: true,
            bodyState: true,
            tombstoneReason: true,
            bodyVersion: true,
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
          thread: deps.toThreadSummary(thread, txViewerParticipant.id, {
            canSendMessage: true,
            unavailableReason: null,
          }),
          message: deps.toMessage(message),
          createdThread,
        };
      });
    },

    async leaveThread(
      authUser: AuthenticatedUserContext,
      threadId: string,
    ): Promise<LeaveConversationThreadResponse> {
      const now = await deps.getDatabaseNow();
      const thread = await deps.findLeavableThread(authUser.id, threadId);

      if (!thread) {
        throw chatErrors.threadLeaveNotAllowed();
      }

      const viewerParticipantId = deps.resolveViewerParticipantId(thread, authUser.id);

      return deps.runSerializableTransaction(async (tx) => {
        await deps.acquireConversationThreadLeaveLock(tx, thread.id);

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
    },
  };
}

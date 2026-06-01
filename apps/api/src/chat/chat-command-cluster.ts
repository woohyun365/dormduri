import type {
  LeaveConversationThreadResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  UpdateChatReadMarkerRequest,
} from '@repo/shared/chat-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { buildParticipantPairIdentity } from '../matches/match.utils.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../common/prisma/prisma-error.js';
import type { ChatUserContext } from './chat-context-owner.js';
import { chatErrors } from './chat.errors.js';
import type { ChatParticipantUserProjection, ThreadRecord } from './chat-selects.js';
import { threadSelect } from './chat-selects.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import type { ChatSendMessageDecision } from './chat-thread-support.js';
import { ChatRealtimeOutboxService } from './outbox/chat-realtime-outbox.service.js';

type ConversationMessageResponseRecord = {
  id: string;
  threadId?: string;
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

type MessageOrderRecord = {
  id: string;
  sentAt: Date;
};

type IdempotentMessageRecord = ConversationMessageResponseRecord & {
  thread: ThreadRecord;
};

const MAX_MESSAGE_BODY_LENGTH = 1000;
const chatRealtimeOutbox = new ChatRealtimeOutboxService();

function assertValidSendMessageInput(input: SendConversationMessageRequest) {
  if (typeof input.clientMessageId !== 'string' || input.clientMessageId.trim().length === 0) {
    throw chatErrors.messageClientMessageIdRequired();
  }
  if (typeof input.body !== 'string' || input.body.trim().length > MAX_MESSAGE_BODY_LENGTH) {
    throw chatErrors.messageBodyTooLong();
  }
}

function compareMessageOrder(left: MessageOrderRecord, right: MessageOrderRecord) {
  const sentAtDelta = left.sentAt.getTime() - right.sentAt.getTime();
  if (sentAtDelta !== 0) {
    return sentAtDelta;
  }
  return left.id.localeCompare(right.id);
}

function getThreadRecipientUserIds(thread: ThreadRecord) {
  return [thread.participantA.userId, thread.participantB.userId];
}

async function findVisibleThreadForActiveMember(
  tx: Prisma.TransactionClient,
  threadId: string,
  participantId: string,
): Promise<ThreadRecord | null> {
  return await tx.conversationThread.findFirst({
    where: {
      id: threadId,
      status: { in: ['OPEN', 'READ_ONLY'] },
      members: {
        some: {
          participantId,
          memberState: 'ACTIVE',
        },
      },
    },
    select: threadSelect,
  });
}

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
      assertValidSendMessageInput(input);

      const normalizedInput = {
        ...input,
        body: input.body.trim(),
        clientMessageId: input.clientMessageId.trim(),
      };
      const now = await deps.getDatabaseNow();
      const viewerContext = await deps.getCurrentChatContext(authUser.id, now);

      if (!viewerContext?.seasonContext || !viewerContext.participant) {
        throw chatErrors.messageSendNotAllowed();
      }

      const targetUser = await deps.getValidatedTargetUser(
        normalizedInput.targetUserId,
        viewerContext.user,
      );
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
        const txTargetUser = await deps.getChatUserProjection(normalizedInput.targetUserId, tx);
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

        const resolveIdempotentMessageResponse = async (
          idempotentMessage: IdempotentMessageRecord,
        ): Promise<SendConversationMessageResponse> => {
          if (
            idempotentMessage.body !== normalizedInput.body ||
            idempotentMessage.thread.pairKey !== pairIdentity.pairKey
          ) {
            throw chatErrors.messageIdempotencyConflict();
          }

          const idempotentThread = await deps.synchronizeThreadLifecycle(
            idempotentMessage.thread,
            now,
            tx,
          );

          if (idempotentThread.status === 'ARCHIVED') {
            throw chatErrors.messageSendNotAllowed();
          }

          const idempotentSendMessageDecision = await deps.canSendMessageToPair(
            txViewerContext,
            txTargetUser,
            txTargetParticipant,
            idempotentThread,
            now,
            tx,
          );

          return {
            thread: deps.toThreadSummary(
              idempotentThread,
              txViewerParticipant.id,
              idempotentSendMessageDecision,
            ),
            message: deps.toMessage(idempotentMessage),
            createdThread: false,
          };
        };

        const existingIdempotentMessage = await tx.conversationMessage.findUnique({
          where: {
            senderParticipantId_clientMessageId: {
              senderParticipantId: txViewerParticipant.id,
              clientMessageId: normalizedInput.clientMessageId,
            },
          },
          select: {
            id: true,
            threadId: true,
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
            thread: {
              select: threadSelect,
            },
          },
        });

        if (existingIdempotentMessage) {
          return resolveIdempotentMessageResponse(existingIdempotentMessage);
        }

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
          await chatRealtimeOutbox.appendThreadUpdated(tx, {
            threadId: thread.id,
            status: thread.status,
            closedReason: thread.closedReason,
            recipientUserIds: [txViewerUser.id, txTargetUser.id],
            occurredAt: now,
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

        let message: ConversationMessageResponseRecord;
        try {
          message = await tx.conversationMessage.create({
            data: {
              threadId: thread.id,
              senderParticipantId: txViewerParticipant.id,
              clientMessageId: normalizedInput.clientMessageId,
              body: normalizedInput.body,
              sentAt: now,
            },
            select: {
              id: true,
              threadId: true,
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
        } catch (error) {
          if (
            isPrismaKnownRequestError(error, 'P2002') &&
            prismaErrorTargetIncludes(error, 'clientMessageId')
          ) {
            const duplicateMessage = await tx.conversationMessage.findUnique({
              where: {
                senderParticipantId_clientMessageId: {
                  senderParticipantId: txViewerParticipant.id,
                  clientMessageId: normalizedInput.clientMessageId,
                },
              },
              select: {
                id: true,
                threadId: true,
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
                thread: {
                  select: threadSelect,
                },
              },
            });

            if (
              duplicateMessage &&
              duplicateMessage.body === normalizedInput.body &&
              duplicateMessage.thread.pairKey === pairIdentity.pairKey
            ) {
              return resolveIdempotentMessageResponse(duplicateMessage);
            }

            throw chatErrors.messageIdempotencyConflict();
          }
          throw error;
        }

        thread = await tx.conversationThread.update({
          where: { id: thread.id },
          data: { lastMessageAt: now },
          select: threadSelect,
        });

        await chatRealtimeOutbox.appendMessageCreated(tx, {
          threadId: thread.id,
          actorUserId: txViewerUser.id,
          message: {
            id: message.id,
            body: message.body,
            senderUserId: message.senderParticipant.userId,
            bodyState: message.bodyState,
            tombstoneReason: message.tombstoneReason,
            bodyVersion: message.bodyVersion,
            sentAt: message.sentAt,
          },
          recipientUserIds: [txViewerUser.id, txTargetUser.id],
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

    async updateReadMarker(
      authUser: AuthenticatedUserContext,
      threadId: string,
      input: UpdateChatReadMarkerRequest,
    ) {
      const now = await deps.getDatabaseNow();
      const thread = await deps.findLeavableThread(authUser.id, threadId);

      if (!thread) {
        throw chatErrors.threadNotFound();
      }

      const synchronizedThread = await deps.synchronizeThreadLifecycle(thread, now);
      if (synchronizedThread.status === 'ARCHIVED') {
        throw chatErrors.threadNotFound();
      }

      const viewerParticipantId = deps.resolveViewerParticipantId(synchronizedThread, authUser.id);

      return deps.runSerializableTransaction(async (tx) => {
        await deps.acquireConversationThreadLeaveLock(tx, synchronizedThread.id);

        const latestThread = await findVisibleThreadForActiveMember(
          tx,
          synchronizedThread.id,
          viewerParticipantId,
        );

        if (!latestThread) {
          throw chatErrors.threadNotFound();
        }

        const txSynchronizedThread = await deps.synchronizeThreadLifecycle(latestThread, now, tx);
        if (txSynchronizedThread.status === 'ARCHIVED') {
          throw chatErrors.threadNotFound();
        }

        const [targetMessage, currentMember] = await Promise.all([
          tx.conversationMessage.findFirst({
            where: {
              id: input.lastReadMessageId,
              threadId: txSynchronizedThread.id,
              deletedAt: null,
            },
            select: {
              id: true,
              sentAt: true,
            },
          }),
          tx.conversationThreadMember.findUnique({
            where: {
              threadId_participantId: {
                threadId: txSynchronizedThread.id,
                participantId: viewerParticipantId,
              },
            },
            select: {
              memberState: true,
              lastReadMessageId: true,
            },
          }),
        ]);

        if (!targetMessage || currentMember?.memberState !== 'ACTIVE') {
          throw chatErrors.threadNotFound();
        }

        if (currentMember.lastReadMessageId) {
          const currentReadMessage = await tx.conversationMessage.findFirst({
            where: {
              id: currentMember.lastReadMessageId,
              threadId: txSynchronizedThread.id,
              deletedAt: null,
            },
            select: {
              id: true,
              sentAt: true,
            },
          });

          if (currentReadMessage && compareMessageOrder(targetMessage, currentReadMessage) < 0) {
            throw chatErrors.readMarkerCannotMoveBackward();
          }
        }

        await tx.conversationThreadMember.update({
          where: {
            threadId_participantId: {
              threadId: txSynchronizedThread.id,
              participantId: viewerParticipantId,
            },
          },
          data: {
            lastReadAt: now,
            lastReadMessageId: targetMessage.id,
          },
        });

        await chatRealtimeOutbox.appendReadMarkerUpdated(tx, {
          threadId: txSynchronizedThread.id,
          lastReadMessageId: targetMessage.id,
          recipientUserIds: [authUser.id],
          occurredAt: now,
        });

        return {
          threadId: txSynchronizedThread.id,
          lastReadMessageId: targetMessage.id,
          lastReadAt: now.toISOString(),
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

        const latestThread = await findVisibleThreadForActiveMember(
          tx,
          thread.id,
          viewerParticipantId,
        );

        if (!latestThread) {
          throw chatErrors.threadLeaveNotAllowed();
        }

        const synchronizedThread = await deps.synchronizeThreadLifecycle(latestThread, now, tx);
        if (synchronizedThread.status === 'ARCHIVED') {
          throw chatErrors.threadLeaveNotAllowed();
        }

        await tx.conversationThreadMember.update({
          where: {
            threadId_participantId: {
              threadId: synchronizedThread.id,
              participantId: viewerParticipantId,
            },
          },
          data: {
            memberState: 'LEFT',
            leftAt: now,
          },
        });

        await chatRealtimeOutbox.appendMemberLeft(tx, {
          threadId: synchronizedThread.id,
          participantId: viewerParticipantId,
          userId: authUser.id,
          leftAt: now,
          recipientUserIds: getThreadRecipientUserIds(synchronizedThread),
        });

        const remainingActiveMembers = await tx.conversationThreadMember.count({
          where: {
            threadId: synchronizedThread.id,
            memberState: 'ACTIVE',
          },
        });

        if (remainingActiveMembers === 0) {
          await tx.conversationThread.update({
            where: { id: synchronizedThread.id },
            data: {
              status: 'ARCHIVED',
              closedAt: synchronizedThread.closedAt ?? now,
            },
          });
          await chatRealtimeOutbox.appendThreadArchived(tx, {
            threadId: synchronizedThread.id,
            closedAt: synchronizedThread.closedAt ?? now,
            closedReason: synchronizedThread.closedReason,
            recipientUserIds: getThreadRecipientUserIds(synchronizedThread),
          });
          return { threadId: synchronizedThread.id, archived: true };
        }

        return { threadId: synchronizedThread.id, archived: false };
      });
    },
  };
}

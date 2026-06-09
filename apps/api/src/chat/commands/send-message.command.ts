import type {
  SendConversationMessageRequest,
  SendConversationMessageResponse,
} from '@repo/shared/chat';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { buildParticipantPairIdentity } from '../../matches/match.utils.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../../platform/database/prisma-error.js';
import type { ChatUserContext } from '../application/chat-user-context.service.js';
import { chatErrors } from '../errors/chat.errors.js';
import { threadSelect, type ThreadRecord } from '../persistence/chat-thread.select.js';
import { ChatRealtimeOutboxService } from '../outbox/chat-realtime-outbox.service.js';
import { assertValidSendMessageInput } from './chat-command.helpers.js';
import type {
  ChatCommandDeps,
  IdempotentMessageRecord,
  ConversationMessageResponseRecord,
} from './chat-command.types.js';

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

function shouldReopenBlockClosedDirectThread(thread: ThreadRecord): boolean {
  return (
    thread.threadKind === 'DIRECT' &&
    thread.activeMatchId === null &&
    thread.status === 'READ_ONLY' &&
    thread.closedReason === 'USER_BLOCKED'
  );
}

export function createSendMessageCommand(deps: ChatCommandDeps) {
  return async function sendMessage(
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
      } else if (shouldReopenBlockClosedDirectThread(thread)) {
        thread = await tx.conversationThread.update({
          where: { id: thread.id },
          data: {
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
      const shouldNotifyThreadCreated = createdThread && !pairActiveMatch;

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

      if (shouldNotifyThreadCreated) {
        await deps.appendChatThreadCreatedNotification(tx, {
          threadId: thread.id,
          actorUserId: txViewerUser.id,
          recipientUserId: txTargetUser.id,
          occurredAt: now,
        });
      }

      return {
        thread: deps.toThreadSummary(thread, txViewerParticipant.id, {
          canSendMessage: true,
          unavailableReason: null,
        }),
        message: deps.toMessage(message),
        createdThread,
      };
    });
  };
}

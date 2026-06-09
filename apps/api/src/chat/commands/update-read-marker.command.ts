import type { UpdateChatReadMarkerRequest } from '@repo/shared/chat';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { chatErrors } from '../errors/chat.errors.js';
import { ChatRealtimeOutboxService } from '../outbox/chat-realtime-outbox.service.js';
import { compareMessageOrder, findVisibleThreadForActiveMember } from './chat-command.helpers.js';
import type { ChatCommandDeps } from './chat-command.types.js';

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

export function createUpdateReadMarkerCommand(deps: ChatCommandDeps) {
  return async function updateReadMarker(
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
  };
}

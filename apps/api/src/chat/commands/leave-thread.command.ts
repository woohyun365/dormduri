import type { LeaveConversationThreadResponse } from '@repo/shared/chat-contract';
import type { AuthenticatedUserContext } from '../../auth/auth-session.service.js';
import { chatErrors } from '../errors/chat.errors.js';
import { ChatRealtimeOutboxService } from '../outbox/chat-realtime-outbox.service.js';
import {
  findVisibleThreadForActiveMember,
  getThreadRecipientUserIds,
} from './chat-command.helpers.js';
import type { ChatCommandDeps } from './chat-command.types.js';

const chatRealtimeOutbox = new ChatRealtimeOutboxService();

export function createLeaveThreadCommand(deps: ChatCommandDeps) {
  return async function leaveThread(
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
  };
}

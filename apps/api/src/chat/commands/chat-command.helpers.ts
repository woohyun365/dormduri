import type { SendConversationMessageRequest } from '@repo/shared/chat';
import type { Prisma } from '../../generated/prisma/client.js';
import { chatErrors } from '../errors/chat.errors.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';
import { threadSelect } from '../persistence/chat-thread.select.js';

export type MessageOrderRecord = {
  id: string;
  sentAt: Date;
};

const MAX_MESSAGE_BODY_LENGTH = 1000;

export function assertValidSendMessageInput(input: SendConversationMessageRequest) {
  if (typeof input.clientMessageId !== 'string' || input.clientMessageId.trim().length === 0) {
    throw chatErrors.messageClientMessageIdRequired();
  }
  if (typeof input.body !== 'string' || input.body.trim().length > MAX_MESSAGE_BODY_LENGTH) {
    throw chatErrors.messageBodyTooLong();
  }
}

export function compareMessageOrder(left: MessageOrderRecord, right: MessageOrderRecord) {
  const sentAtDelta = left.sentAt.getTime() - right.sentAt.getTime();
  if (sentAtDelta !== 0) {
    return sentAtDelta;
  }
  return left.id.localeCompare(right.id);
}

export function getThreadRecipientUserIds(thread: ThreadRecord) {
  return [thread.participantA.userId, thread.participantB.userId];
}

export async function findVisibleThreadForActiveMember(
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

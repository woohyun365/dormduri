import type { ConversationMessage, ConversationThreadSummary } from '@repo/shared/chat-contract';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';
import type { ChatSendMessageDecision } from '../policies/chat-thread-permission.policy.js';

export function toChatThreadSummary(
  thread: ThreadRecord,
  viewerParticipantId: string,
  sendMessageDecision: ChatSendMessageDecision,
): ConversationThreadSummary {
  const viewerIsParticipantA = thread.participantAId === viewerParticipantId;

  return {
    id: thread.id,
    seasonId: thread.seasonId,
    counterpartUserId: viewerIsParticipantA
      ? thread.participantB.userId
      : thread.participantA.userId,
    counterpartParticipantId: viewerIsParticipantA ? thread.participantBId : thread.participantAId,
    threadKind: thread.threadKind,
    status: thread.status,
    closedReason: thread.closedReason,
    closedAt: thread.closedAt?.toISOString() ?? null,
    lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
    canSendMessage: sendMessageDecision.canSendMessage,
    sendMessageUnavailableReason: sendMessageDecision.unavailableReason,
    canReport: true,
  };
}

export function toChatMessage(message: ThreadRecord['messages'][number]): ConversationMessage {
  return {
    id: message.id,
    senderUserId: message.senderParticipant.userId,
    body: message.body,
    bodyState: message.bodyState,
    tombstoneReason: message.tombstoneReason,
    bodyVersion: message.bodyVersion,
    sentAt: message.sentAt.toISOString(),
  };
}

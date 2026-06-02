import type {
  LeaveConversationThreadResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  UpdateChatReadMarkerRequest,
} from '@repo/shared/chat-contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../../auth/auth-session.service.js';
import type { ChatUserContext } from '../application/chat-user-context.service.js';
import type {
  ChatParticipantUserProjection,
  ThreadRecord,
} from '../persistence/chat-thread.select.js';
import type { CurrentSeasonParticipantRecord } from '../../season-participants/season-participants.service.js';
import type { ChatSendMessageDecision } from '../policies/chat-thread-policy.js';

export type ConversationMessageResponseRecord = {
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

export type IdempotentMessageRecord = ConversationMessageResponseRecord & {
  thread: ThreadRecord;
};

export type ChatCommandService = {
  sendMessage(
    authUser: AuthenticatedUserContext,
    input: SendConversationMessageRequest,
  ): Promise<SendConversationMessageResponse>;
  updateReadMarker(
    authUser: AuthenticatedUserContext,
    threadId: string,
    input: UpdateChatReadMarkerRequest,
  ): Promise<{
    threadId: string;
    lastReadMessageId: string;
    lastReadAt: string;
  }>;
  leaveThread(
    authUser: AuthenticatedUserContext,
    threadId: string,
  ): Promise<LeaveConversationThreadResponse>;
};

export interface ChatCommandDeps {
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
  appendChatThreadCreatedNotification(
    tx: Prisma.TransactionClient,
    input: {
      threadId: string;
      actorUserId: string;
      recipientUserId: string;
      occurredAt: Date;
    },
  ): Promise<unknown>;
}

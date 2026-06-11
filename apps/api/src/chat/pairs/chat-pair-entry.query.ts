import type { ConversationThreadEntryResponse } from '@repo/shared/chat';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { CurrentSeasonParticipantRecord } from '../../season-participants/application/season-participants.service.js';
import type { ChatUserContext } from '../application/chat-user-context.service.js';
import type {
  ChatParticipantUserProjection,
  ThreadRecord,
} from '../persistence/chat-thread.select.js';
import type { ChatSendMessageDecision } from '../policies/chat-thread-permission.policy.js';

interface ChatPairEntryQueryDeps {
  getDatabaseNow(): Promise<Date>;
  getCurrentChatContext(userId: string, now: Date): Promise<ChatUserContext | null>;
  getValidatedTargetUser(
    targetUserId: string,
    viewerUser: ChatParticipantUserProjection,
  ): Promise<ChatParticipantUserProjection>;
  getRequiredParticipant(
    targetUser: ChatParticipantUserProjection,
    seasonId: string,
  ): Promise<CurrentSeasonParticipantRecord>;
  findThreadByPair(
    seasonId: string,
    leftParticipantId: string,
    rightParticipantId: string,
  ): Promise<ThreadRecord | null>;
  resolveThreadLifecycleSnapshot(thread: ThreadRecord, now: Date): Promise<ThreadRecord>;
  canSendMessageToPair(
    viewerContext: ChatUserContext,
    targetUser: ChatParticipantUserProjection,
    targetParticipant: CurrentSeasonParticipantRecord,
    thread: ThreadRecord | null,
    now: Date,
  ): Promise<ChatSendMessageDecision>;
  getThreadMember(
    thread: ThreadRecord,
    participantId: string,
  ): ThreadRecord['members'][number] | null;
  toThreadSummary(
    thread: ThreadRecord,
    viewerParticipantId: string,
    sendMessageDecision: ChatSendMessageDecision,
  ): NonNullable<ConversationThreadEntryResponse['thread']>;
}

export function createChatPairEntryQuery(deps: ChatPairEntryQueryDeps) {
  return {
    async getThreadEntry(
      authUser: AuthenticatedUserContext,
      targetUserId: string,
    ): Promise<ConversationThreadEntryResponse> {
      const now = await deps.getDatabaseNow();
      const viewerContext = await deps.getCurrentChatContext(authUser.id, now);

      if (!viewerContext?.seasonContext || !viewerContext.participant) {
        return {
          targetUserId,
          thread: null,
          canEnterChatUi: false,
          canSendMessage: false,
        };
      }

      const targetUser = await deps.getValidatedTargetUser(targetUserId, viewerContext.user);
      const targetParticipant = await deps.getRequiredParticipant(
        targetUser,
        viewerContext.seasonContext.season.id,
      );
      const existingThread = await deps.findThreadByPair(
        viewerContext.seasonContext.season.id,
        viewerContext.participant.id,
        targetParticipant.id,
      );
      const synchronizedThread = existingThread
        ? await deps.resolveThreadLifecycleSnapshot(existingThread, now)
        : null;
      const sendMessageDecision = await deps.canSendMessageToPair(
        viewerContext,
        targetUser,
        targetParticipant,
        synchronizedThread,
        now,
      );

      const visibleThread = resolveVisiblePairThread(
        synchronizedThread,
        viewerContext.participant.id,
        (thread, participantId) => deps.getThreadMember(thread, participantId),
      );

      return {
        targetUserId,
        thread: visibleThread
          ? deps.toThreadSummary(visibleThread, viewerContext.participant.id, sendMessageDecision)
          : null,
        canEnterChatUi: visibleThread !== null || sendMessageDecision.canSendMessage,
        canSendMessage: sendMessageDecision.canSendMessage,
      };
    },
  };
}

function resolveVisiblePairThread(
  thread: ThreadRecord | null,
  viewerParticipantId: string,
  getThreadMember: ChatPairEntryQueryDeps['getThreadMember'],
) {
  if (!thread || thread.status === 'ARCHIVED') {
    return null;
  }

  const viewerMember = getThreadMember(thread, viewerParticipantId);
  return viewerMember?.memberState === 'ACTIVE' ? thread : null;
}

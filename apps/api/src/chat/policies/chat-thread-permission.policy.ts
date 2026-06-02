import type { ChatSendMessageUnavailableReason } from '@repo/shared/chat-contract';
import type { SeasonState } from '@repo/shared/season-contract';
import { formatKstDate } from '../../seasons/season.utils.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';

export interface ChatSendMessageDecision {
  canSendMessage: boolean;
  unavailableReason: ChatSendMessageUnavailableReason | null;
}

export const canSendMessageDecision = (): ChatSendMessageDecision => ({
  canSendMessage: true,
  unavailableReason: null,
});

export const cannotSendMessageDecision = (
  unavailableReason: ChatSendMessageUnavailableReason,
): ChatSendMessageDecision => ({
  canSendMessage: false,
  unavailableReason,
});

export function getThreadMember(thread: ThreadRecord, participantId: string) {
  return thread.members.find((member) => member.participantId === participantId) ?? null;
}

export function isThreadParticipant(thread: ThreadRecord, participantId: string) {
  return thread.participantAId === participantId || thread.participantBId === participantId;
}

export function isViewerInThread(thread: ThreadRecord, userId: string) {
  return thread.participantA.userId === userId || thread.participantB.userId === userId;
}

export function resolveViewerParticipantIdOrNull(thread: ThreadRecord, viewerUserId: string) {
  if (thread.participantA.userId === viewerUserId) {
    return thread.participantAId;
  }
  if (thread.participantB.userId === viewerUserId) {
    return thread.participantBId;
  }
  return null;
}

interface ThreadSendMessageDecisionInput {
  thread: ThreadRecord;
  viewerParticipantId: string;
  now: Date;
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
  resolveThreadSeasonState(thread: ThreadRecord, now: Date): SeasonState;
}

export function resolveThreadSendMessageDecision(
  input: ThreadSendMessageDecisionInput,
): ChatSendMessageDecision {
  const { thread, viewerParticipantId, now } = input;
  const viewerMember = getThreadMember(thread, viewerParticipantId);
  if (!isThreadParticipant(thread, viewerParticipantId)) {
    return cannotSendMessageDecision('SAFETY_OR_VISIBILITY_RESTRICTED');
  }
  if (viewerMember?.memberState === 'LEFT') {
    return cannotSendMessageDecision('MEMBER_LEFT');
  }
  if (thread.status === 'ARCHIVED') {
    return cannotSendMessageDecision('ARCHIVED_THREAD');
  }
  if (thread.status !== 'OPEN') {
    return cannotSendMessageDecision(
      thread.closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
    );
  }

  if (thread.threadKind === 'MATCHED') {
    const state = input.resolveThreadSeasonState(thread, now);
    if (state === 'SEASON_MATCHING' || state === 'SEASON_POST_MATCH') {
      return canSendMessageDecision();
    }
    return cannotSendMessageDecision('SEASON_ENDED');
  }

  const roomSelectionDate = input.findThreadRoomSelectionDate(thread);
  if (roomSelectionDate && formatKstDate(now) <= roomSelectionDate) {
    return canSendMessageDecision();
  }

  return cannotSendMessageDecision('THREAD_READ_ONLY');
}

export function resolveMatchedPairThreadSendMessageDecision(
  input: Omit<ThreadSendMessageDecisionInput, 'findThreadRoomSelectionDate'>,
): ChatSendMessageDecision {
  const { thread, viewerParticipantId, now } = input;
  if (thread.status !== 'OPEN') {
    return cannotSendMessageDecision(
      thread.closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
    );
  }
  if (!isThreadParticipant(thread, viewerParticipantId)) {
    return cannotSendMessageDecision('SAFETY_OR_VISIBILITY_RESTRICTED');
  }

  const viewerMember = getThreadMember(thread, viewerParticipantId);
  if (viewerMember?.memberState === 'LEFT') {
    return cannotSendMessageDecision('MEMBER_LEFT');
  }

  const state = input.resolveThreadSeasonState(thread, now);
  return state === 'SEASON_MATCHING' || state === 'SEASON_POST_MATCH'
    ? canSendMessageDecision()
    : cannotSendMessageDecision('SEASON_ENDED');
}

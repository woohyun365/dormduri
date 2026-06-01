import type { ThreadRecord } from './chat-selects.js';

export type DirectThreadReopenStaticDecision =
  | { kind: 'REOPEN_CANDIDATE' }
  | {
      kind: 'KEEP_READ_ONLY';
      reason:
        | 'NOT_DIRECT_THREAD'
        | 'NOT_ACTIVE_MATCH_CREATED'
        | 'NOT_READ_ONLY'
        | 'ACTIVE_MATCH_THREAD'
        | 'NO_ACTIVE_MEMBER'
        | 'ROOM_SELECTION_CUTOFF';
    };

export function resolveDirectThreadReopenStaticDecision(input: {
  thread: ThreadRecord;
  now: Date;
  findThreadRoomSelectionDate(thread: ThreadRecord): string | null;
  formatKstDate(date: Date): string;
}): DirectThreadReopenStaticDecision {
  if (input.thread.threadKind !== 'DIRECT') {
    return { kind: 'KEEP_READ_ONLY', reason: 'NOT_DIRECT_THREAD' };
  }
  if (input.thread.activeMatchId !== null) {
    return { kind: 'KEEP_READ_ONLY', reason: 'ACTIVE_MATCH_THREAD' };
  }
  if (input.thread.status !== 'READ_ONLY') {
    return { kind: 'KEEP_READ_ONLY', reason: 'NOT_READ_ONLY' };
  }
  if (input.thread.closedReason !== 'ACTIVE_MATCH_CREATED') {
    return { kind: 'KEEP_READ_ONLY', reason: 'NOT_ACTIVE_MATCH_CREATED' };
  }
  if (!input.thread.members.some((member) => member.memberState === 'ACTIVE')) {
    return { kind: 'KEEP_READ_ONLY', reason: 'NO_ACTIVE_MEMBER' };
  }

  const roomSelectionDate = input.findThreadRoomSelectionDate(input.thread);
  if (!roomSelectionDate || input.formatKstDate(input.now) > roomSelectionDate) {
    return { kind: 'KEEP_READ_ONLY', reason: 'ROOM_SELECTION_CUTOFF' };
  }

  return { kind: 'REOPEN_CANDIDATE' };
}

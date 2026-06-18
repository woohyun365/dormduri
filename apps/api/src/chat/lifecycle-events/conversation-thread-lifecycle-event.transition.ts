import type { ThreadRecord } from '../persistence/chat-thread.select.js';
import type { ConversationThreadLifecycleEventMetadataInput } from './conversation-thread-lifecycle-event.types.js';

type ThreadLifecycleSnapshot = Pick<ThreadRecord, 'closedReason' | 'status' | 'threadKind'>;

export function toConversationThreadLifecycleTransitionMetadata(input: {
  previous?: Partial<ThreadLifecycleSnapshot> | null;
  next: Partial<ThreadLifecycleSnapshot>;
}): ConversationThreadLifecycleEventMetadataInput {
  return omitUndefinedMetadata({
    previousStatus: input.previous?.status ?? null,
    nextStatus: input.next.status,
    previousThreadKind: input.previous?.threadKind ?? null,
    nextThreadKind: input.next.threadKind,
    previousClosedReason: input.previous?.closedReason ?? null,
    nextClosedReason: input.next.closedReason,
  });
}

function omitUndefinedMetadata(
  metadata: ConversationThreadLifecycleEventMetadataInput,
): ConversationThreadLifecycleEventMetadataInput {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

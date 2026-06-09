import type { ChatRealtimeEvent } from '@repo/shared/chat/realtime-events';
import { chatRealtimeEventSchema } from '@repo/shared/chat/realtime-events';

export const FORBIDDEN_CHAT_REALTIME_PAYLOAD_KEYS = [
  'retainedOriginalBody',
  'retainedVaultObjectId',
  'retainedVaultObject',
  'encryptedPayload',
  'vaultPayload',
  'retainedVaultPayload',
  'rawRetainedBody',
  'internalAuditData',
  'retentionAccessLog',
  'approvalReference',
  'accessedBy',
  'disclosedFields',
  'retentionCaseId',
] as const;

const forbiddenPayloadKeys = new Set<string>(FORBIDDEN_CHAT_REALTIME_PAYLOAD_KEYS);

export type ChatRealtimeEventType = ChatRealtimeEvent['eventType'];

export function assertChatRealtimePayloadAllowed(payload: unknown): void {
  const forbiddenKey = findForbiddenPayloadKey(payload);
  if (forbiddenKey) {
    throw new Error(`[chat-realtime-event-mapper] forbidden payload key: ${forbiddenKey}`);
  }
}

export function isChatRealtimePayloadPrivacySafe(payload: unknown): boolean {
  return findForbiddenPayloadKey(payload) === null;
}

export function toChatMessageCreatedPayload(input: {
  id: string;
  senderUserId: string;
  body: string;
  bodyState: 'PLAIN' | 'TOMBSTONED' | 'DISPOSED';
  tombstoneReason: string | null;
  bodyVersion: number;
  sentAt: Date;
}) {
  return assertAllowedPayload({
    message: {
      id: input.id,
      senderUserId: input.senderUserId,
      body: input.body,
      bodyState: input.bodyState,
      tombstoneReason: input.tombstoneReason,
      bodyVersion: input.bodyVersion,
      sentAt: input.sentAt.toISOString(),
    },
  });
}

export function toChatMessageTombstonedPayload(input: {
  messageId: string;
  body: string;
  bodyState: 'TOMBSTONED' | 'DISPOSED';
  tombstoneReason: string;
  bodyVersion: number;
}) {
  return assertAllowedPayload({
    messageId: input.messageId,
    body: input.body,
    bodyState: input.bodyState,
    tombstoneReason: input.tombstoneReason,
    bodyVersion: input.bodyVersion,
  });
}

export function toChatReadMarkerUpdatedPayload(input: {
  threadId: string;
  lastReadMessageId: string;
  unreadCount?: number;
}) {
  return assertAllowedPayload({
    threadId: input.threadId,
    lastReadMessageId: input.lastReadMessageId,
    ...(input.unreadCount === undefined ? {} : { unreadCount: input.unreadCount }),
  });
}

export function toChatMemberLeftPayload(input: {
  threadId: string;
  participantId: string;
  userId: string;
  leftAt: Date;
}) {
  return assertAllowedPayload({
    threadId: input.threadId,
    participantId: input.participantId,
    userId: input.userId,
    leftAt: input.leftAt.toISOString(),
  });
}

export function toChatThreadUpdatedPayload(input: {
  threadId: string;
  status: 'OPEN' | 'READ_ONLY' | 'ARCHIVED';
  closedReason: string | null;
}) {
  return assertAllowedPayload({
    threadId: input.threadId,
    status: input.status,
    closedReason: input.closedReason,
  });
}

export function toChatThreadArchivedPayload(input: {
  threadId: string;
  closedAt: Date;
  closedReason: string | null;
}) {
  return assertAllowedPayload({
    threadId: input.threadId,
    closedAt: input.closedAt.toISOString(),
    closedReason: input.closedReason,
  });
}

export function toChatRealtimeEventEnvelope(input: {
  schemaVersion: 1;
  eventId: string;
  eventType: ChatRealtimeEventType;
  occurredAt: Date;
  cursor: string;
  threadId?: string | null;
  payload: unknown;
}): ChatRealtimeEvent {
  assertChatRealtimePayloadAllowed(input.payload);

  return chatRealtimeEventSchema.parse({
    schemaVersion: input.schemaVersion,
    eventId: input.eventId,
    eventType: input.eventType,
    occurredAt: input.occurredAt.toISOString(),
    cursor: input.cursor,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    payload: input.payload,
  });
}

function assertAllowedPayload<T extends Record<string, unknown>>(payload: T): T {
  assertChatRealtimePayloadAllowed(payload);
  return payload;
}

function findForbiddenPayloadKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findForbiddenPayloadKey(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenPayloadKeys.has(key)) {
      return key;
    }
    const nested = findForbiddenPayloadKey(nestedValue);
    if (nested) {
      return nested;
    }
  }

  return null;
}

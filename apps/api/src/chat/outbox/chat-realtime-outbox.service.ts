import {
  assertChatRealtimePayloadAllowed,
  toChatMemberLeftPayload,
  toChatMessageCreatedPayload,
  toChatMessageTombstonedPayload,
  toChatReadMarkerUpdatedPayload,
  toChatThreadArchivedPayload,
  toChatThreadUpdatedPayload,
} from '../realtime/chat-realtime-event.mapper.js';

export type ChatRealtimeOutboxTx = {
  chatRealtimeOutboxEvent: {
    create(args: unknown): Promise<{ id: string }>;
    deleteMany?(args: unknown): Promise<{ count: number }>;
  };
  chatRealtimeEventRecipient: {
    createMany(args: unknown): Promise<unknown>;
  };
};

type OutboxEventInput = {
  eventType: string;
  threadId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  payload: Record<string, unknown>;
  recipientUserIds: string[];
  occurredAt: Date;
  availableAt?: Date;
};

type MessageCreatedInput = {
  threadId: string;
  actorUserId: string;
  message: {
    id: string;
    body: string;
    senderUserId: string;
    bodyState?: 'PLAIN' | 'TOMBSTONED' | 'DISPOSED';
    tombstoneReason?: string | null;
    bodyVersion?: number;
    sentAt: Date;
  };
  recipientUserIds: string[];
};

type MessageTombstonedInput = {
  threadId: string;
  messageId: string;
  body: string;
  bodyState: 'TOMBSTONED' | 'DISPOSED';
  tombstoneReason: string;
  bodyVersion: number;
  recipientUserIds: string[];
  occurredAt?: Date;
};

type ReadMarkerUpdatedInput = {
  threadId: string;
  lastReadMessageId: string;
  unreadCount?: number;
  recipientUserIds: string[];
  occurredAt: Date;
};

type MemberLeftInput = {
  threadId: string;
  participantId: string;
  userId: string;
  leftAt: Date;
  recipientUserIds: string[];
};

type ThreadUpdatedInput = {
  threadId: string;
  status: 'OPEN' | 'READ_ONLY' | 'ARCHIVED';
  closedReason: string | null;
  recipientUserIds: string[];
  occurredAt: Date;
};

type ThreadArchivedInput = {
  threadId: string;
  closedAt: Date;
  closedReason: string | null;
  recipientUserIds: string[];
};

function userRoomKey(userId: string) {
  return `user:${userId}`;
}

function recipientCursor(eventId: string, userId: string) {
  return `${eventId}:${userId}`;
}

function uniqueUserIds(userIds: string[]) {
  return [...new Set(userIds.filter((userId) => userId.trim().length > 0))];
}

export function hasChatRealtimeOutboxTx(candidate: unknown): candidate is ChatRealtimeOutboxTx {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const tx = candidate as Partial<ChatRealtimeOutboxTx>;
  return (
    typeof tx.chatRealtimeOutboxEvent?.create === 'function' &&
    typeof tx.chatRealtimeEventRecipient?.createMany === 'function'
  );
}

export class ChatRealtimeOutboxService {
  constructor(_deps: unknown = {}) {}

  async appendMessageCreated(tx: ChatRealtimeOutboxTx, input: MessageCreatedInput) {
    return this.appendEvent(tx, {
      eventType: 'chat.message.created',
      threadId: input.threadId,
      aggregateType: 'conversation.message',
      aggregateId: input.message.id,
      aggregateVersion: input.message.bodyVersion ?? 1,
      payload: toChatMessageCreatedPayload({
        id: input.message.id,
        senderUserId: input.message.senderUserId,
        body: input.message.body,
        bodyState: input.message.bodyState ?? 'PLAIN',
        tombstoneReason: input.message.tombstoneReason ?? null,
        bodyVersion: input.message.bodyVersion ?? 1,
        sentAt: input.message.sentAt,
      }),
      recipientUserIds: input.recipientUserIds,
      occurredAt: input.message.sentAt,
      availableAt: input.message.sentAt,
    });
  }

  async appendMessageTombstoned(tx: ChatRealtimeOutboxTx, input: MessageTombstonedInput) {
    const occurredAt = input.occurredAt ?? new Date();

    return this.appendEvent(tx, {
      eventType: 'chat.message.tombstoned',
      threadId: input.threadId,
      aggregateType: 'conversation.message',
      aggregateId: input.messageId,
      aggregateVersion: input.bodyVersion,
      payload: toChatMessageTombstonedPayload({
        messageId: input.messageId,
        body: input.body,
        bodyState: input.bodyState,
        tombstoneReason: input.tombstoneReason,
        bodyVersion: input.bodyVersion,
      }),
      recipientUserIds: input.recipientUserIds,
      occurredAt,
      availableAt: occurredAt,
    });
  }

  async appendReadMarkerUpdated(tx: ChatRealtimeOutboxTx, input: ReadMarkerUpdatedInput) {
    return this.appendEvent(tx, {
      eventType: 'chat.read_marker.updated',
      threadId: input.threadId,
      aggregateType: 'conversation.thread_member',
      aggregateId: input.threadId,
      aggregateVersion: null,
      payload: toChatReadMarkerUpdatedPayload({
        threadId: input.threadId,
        lastReadMessageId: input.lastReadMessageId,
        unreadCount: input.unreadCount,
      }),
      recipientUserIds: input.recipientUserIds,
      occurredAt: input.occurredAt,
      availableAt: input.occurredAt,
    });
  }

  async appendMemberLeft(tx: ChatRealtimeOutboxTx, input: MemberLeftInput) {
    return this.appendEvent(tx, {
      eventType: 'chat.member.left',
      threadId: input.threadId,
      aggregateType: 'conversation.thread_member',
      aggregateId: input.participantId,
      aggregateVersion: null,
      payload: toChatMemberLeftPayload({
        threadId: input.threadId,
        participantId: input.participantId,
        userId: input.userId,
        leftAt: input.leftAt,
      }),
      recipientUserIds: input.recipientUserIds,
      occurredAt: input.leftAt,
      availableAt: input.leftAt,
    });
  }

  async appendThreadUpdated(tx: ChatRealtimeOutboxTx, input: ThreadUpdatedInput) {
    return this.appendEvent(tx, {
      eventType: 'chat.thread.updated',
      threadId: input.threadId,
      aggregateType: 'conversation.thread',
      aggregateId: input.threadId,
      aggregateVersion: null,
      payload: toChatThreadUpdatedPayload({
        threadId: input.threadId,
        status: input.status,
        closedReason: input.closedReason,
      }),
      recipientUserIds: input.recipientUserIds,
      occurredAt: input.occurredAt,
      availableAt: input.occurredAt,
    });
  }

  async appendThreadArchived(tx: ChatRealtimeOutboxTx, input: ThreadArchivedInput) {
    return this.appendEvent(tx, {
      eventType: 'chat.thread.archived',
      threadId: input.threadId,
      aggregateType: 'conversation.thread',
      aggregateId: input.threadId,
      aggregateVersion: null,
      payload: toChatThreadArchivedPayload({
        threadId: input.threadId,
        closedAt: input.closedAt,
        closedReason: input.closedReason,
      }),
      recipientUserIds: input.recipientUserIds,
      occurredAt: input.closedAt,
      availableAt: input.closedAt,
    });
  }

  async deleteMessageCreatedEventsForMessage(
    tx: ChatRealtimeOutboxTx,
    input: { messageId: string },
  ): Promise<{ count: number }> {
    if (typeof tx.chatRealtimeOutboxEvent.deleteMany !== 'function') {
      return { count: 0 };
    }

    return tx.chatRealtimeOutboxEvent.deleteMany({
      where: {
        eventType: 'chat.message.created',
        aggregateType: 'conversation.message',
        aggregateId: input.messageId,
      },
    }) as Promise<{ count: number }>;
  }

  private async appendEvent(tx: ChatRealtimeOutboxTx, input: OutboxEventInput) {
    assertChatRealtimePayloadAllowed(input.payload);

    const recipientUserIds = uniqueUserIds(input.recipientUserIds);
    const outboxEvent = await tx.chatRealtimeOutboxEvent.create({
      data: {
        eventType: input.eventType,
        schemaVersion: 1,
        threadId: input.threadId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        aggregateVersion: input.aggregateVersion,
        payload: input.payload,
        roomKeys: recipientUserIds.map(userRoomKey),
        occurredAt: input.occurredAt,
        availableAt: input.availableAt ?? input.occurredAt,
      },
      select: { id: true },
    });

    if (recipientUserIds.length > 0) {
      await tx.chatRealtimeEventRecipient.createMany({
        data: recipientUserIds.map((userId) => ({
          eventId: outboxEvent.id,
          userId,
          threadId: input.threadId,
          cursor: recipientCursor(outboxEvent.id, userId),
          createdAt: input.occurredAt,
        })),
        skipDuplicates: true,
      });
    }

    return outboxEvent;
  }
}

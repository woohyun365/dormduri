type OutboxTx = {
  chatRealtimeOutboxEvent: {
    create(args: {
      data: {
        eventType: string;
        schemaVersion: number;
        threadId: string;
        aggregateType: string;
        aggregateId: string;
        aggregateVersion: number;
        payload: Record<string, unknown>;
        roomKeys: string[];
        occurredAt?: Date;
        availableAt?: Date;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  chatRealtimeEventRecipient: {
    createMany(args: {
      data: Array<{ eventId: string; userId: string; threadId: string; cursor: string }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
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
};

function userRoomKey(userId: string) {
  return `user:${userId}`;
}

function recipientCursor(eventId: string, userId: string) {
  return `${eventId}:${userId}`;
}

export class ChatRealtimeOutboxService {
  constructor(_deps: unknown = {}) {}

  async appendMessageCreated(tx: OutboxTx, input: MessageCreatedInput) {
    const outboxEvent = await tx.chatRealtimeOutboxEvent.create({
      data: {
        eventType: 'chat.message.created',
        schemaVersion: 1,
        threadId: input.threadId,
        aggregateType: 'conversation.message',
        aggregateId: input.message.id,
        aggregateVersion: input.message.bodyVersion ?? 1,
        payload: {
          message: {
            id: input.message.id,
            senderUserId: input.message.senderUserId,
            body: input.message.body,
            bodyState: input.message.bodyState ?? 'PLAIN',
            tombstoneReason: input.message.tombstoneReason ?? null,
            bodyVersion: input.message.bodyVersion ?? 1,
            sentAt: input.message.sentAt.toISOString(),
          },
        },
        roomKeys: input.recipientUserIds.map(userRoomKey),
        occurredAt: input.message.sentAt,
        availableAt: input.message.sentAt,
      },
      select: { id: true },
    });

    await tx.chatRealtimeEventRecipient.createMany({
      data: input.recipientUserIds.map((userId) => ({
        eventId: outboxEvent.id,
        userId,
        threadId: input.threadId,
        cursor: recipientCursor(outboxEvent.id, userId),
      })),
      skipDuplicates: true,
    });

    return outboxEvent;
  }

  async appendMessageTombstoned(tx: OutboxTx, input: MessageTombstonedInput) {
    const outboxEvent = await tx.chatRealtimeOutboxEvent.create({
      data: {
        eventType: 'chat.message.tombstoned',
        schemaVersion: 1,
        threadId: input.threadId,
        aggregateType: 'conversation.message',
        aggregateId: input.messageId,
        aggregateVersion: input.bodyVersion,
        payload: {
          messageId: input.messageId,
          body: input.body,
          bodyState: input.bodyState,
          tombstoneReason: input.tombstoneReason,
          bodyVersion: input.bodyVersion,
        },
        roomKeys: input.recipientUserIds.map(userRoomKey),
      },
      select: { id: true },
    });

    await tx.chatRealtimeEventRecipient.createMany({
      data: input.recipientUserIds.map((userId) => ({
        eventId: outboxEvent.id,
        userId,
        threadId: input.threadId,
        cursor: recipientCursor(outboxEvent.id, userId),
      })),
      skipDuplicates: true,
    });

    return outboxEvent;
  }
}

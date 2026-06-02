import {
  claimChatRealtimeOutboxEvents,
  findChatRealtimeOutboxRecipients,
  pruneExpiredChatRealtimeOutboxEvents,
} from '../../generated/prisma/sql.js';

type TypedQueryable = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
};

type OutboxMutableClient = {
  chatRealtimeOutboxEvent: {
    update(args: unknown): Promise<unknown>;
  };
};

export type ClaimedChatRealtimeOutboxEvent = {
  id: string;
  eventType: string;
  schemaVersion: number;
  threadId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  payload: unknown;
  roomKeys: string[];
  occurredAt: Date;
  availableAt: Date;
  publishAttempts: number;
};

export type ChatRealtimeOutboxRecipient = {
  eventId: string;
  userId: string;
  threadId: string | null;
  cursor: string;
};

export class ChatRealtimeOutboxRepository {
  async claimPublishableBatch(
    prisma: TypedQueryable,
    input: { limit: number; now: Date; claimLeaseMs: number },
  ): Promise<ClaimedChatRealtimeOutboxEvent[]> {
    const safeLimit = Math.max(1, Math.min(input.limit, 100));
    const leaseUntil = new Date(input.now.getTime() + input.claimLeaseMs);

    const rows = await prisma.$queryRawTyped<claimChatRealtimeOutboxEvents.Result>(
      claimChatRealtimeOutboxEvents(input.now, leaseUntil, safeLimit),
    );

    return rows.map((row) => ({
      ...row,
      roomKeys: row.roomKeys ?? [],
    }));
  }

  async pruneExpired(
    prisma: TypedQueryable,
    input: { now: Date; replayWindowDays?: number },
  ): Promise<number> {
    const replayWindowDays = input.replayWindowDays ?? 7;
    const cutoff = new Date(input.now.getTime() - replayWindowDays * 24 * 60 * 60 * 1000);
    const [result] = await prisma.$queryRawTyped<pruneExpiredChatRealtimeOutboxEvents.Result>(
      pruneExpiredChatRealtimeOutboxEvents(cutoff),
    );

    return result?.deletedCount ?? 0;
  }

  async findRecipientsForEvent(
    prisma: TypedQueryable,
    input: { eventId: string },
  ): Promise<ChatRealtimeOutboxRecipient[]> {
    return prisma.$queryRawTyped<findChatRealtimeOutboxRecipients.Result>(
      findChatRealtimeOutboxRecipients(input.eventId),
    );
  }

  async markPublished(
    prisma: OutboxMutableClient,
    input: { eventId: string; now: Date },
  ): Promise<void> {
    await prisma.chatRealtimeOutboxEvent.update({
      where: { id: input.eventId },
      data: {
        publishedAt: input.now,
        lastPublishError: null,
        updatedAt: input.now,
      },
    });
  }

  async markPublishFailed(
    prisma: OutboxMutableClient,
    input: { eventId: string; now: Date; nextAvailableAt: Date; error: string },
  ): Promise<void> {
    await prisma.chatRealtimeOutboxEvent.update({
      where: { id: input.eventId },
      data: {
        availableAt: input.nextAvailableAt,
        lastPublishError: input.error.slice(0, 1_000),
        updatedAt: input.now,
      },
    });
  }
}

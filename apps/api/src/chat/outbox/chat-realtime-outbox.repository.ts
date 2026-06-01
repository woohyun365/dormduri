import { Prisma } from '../../generated/prisma/client.js';

type RawQueryable = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

type RawExecutable = {
  $executeRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
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
    prisma: RawQueryable,
    input: { limit: number; now: Date; claimLeaseMs: number },
  ): Promise<ClaimedChatRealtimeOutboxEvent[]> {
    const safeLimit = Math.max(1, Math.min(input.limit, 100));
    const leaseUntil = new Date(input.now.getTime() + input.claimLeaseMs);

    return prisma.$queryRaw<ClaimedChatRealtimeOutboxEvent[]>(Prisma.sql`
      WITH picked AS (
        SELECT "id"
        FROM "ChatRealtimeOutboxEvent"
        WHERE "publishedAt" IS NULL
          AND "availableAt" <= ${input.now}
        ORDER BY "availableAt" ASC, "occurredAt" ASC, "id" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "ChatRealtimeOutboxEvent" AS event
      SET "availableAt" = ${leaseUntil},
          "publishAttempts" = event."publishAttempts" + 1,
          "updatedAt" = ${input.now}
      FROM picked
      WHERE event."id" = picked."id"
      RETURNING
        event."id",
        event."eventType",
        event."schemaVersion",
        event."threadId",
        event."aggregateType",
        event."aggregateId",
        event."aggregateVersion",
        event."payload",
        event."roomKeys",
        event."occurredAt",
        event."availableAt",
        event."publishAttempts"
    `);
  }

  async pruneExpired(
    prisma: RawExecutable,
    input: { now: Date; replayWindowDays?: number },
  ): Promise<number> {
    const replayWindowDays = input.replayWindowDays ?? 7;
    const cutoff = new Date(input.now.getTime() - replayWindowDays * 24 * 60 * 60 * 1000);
    const deletedCount = await prisma.$executeRaw<number>(Prisma.sql`
      DELETE FROM "ChatRealtimeOutboxEvent"
      WHERE "occurredAt" < ${cutoff}
    `);

    return Number(deletedCount);
  }

  async findRecipientsForEvent(
    prisma: RawQueryable,
    input: { eventId: string },
  ): Promise<ChatRealtimeOutboxRecipient[]> {
    return prisma.$queryRaw<ChatRealtimeOutboxRecipient[]>(Prisma.sql`
      SELECT "eventId", "userId", "threadId", "cursor"
      FROM "ChatRealtimeEventRecipient"
      WHERE "eventId" = ${input.eventId}
      ORDER BY "userId" ASC
    `);
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

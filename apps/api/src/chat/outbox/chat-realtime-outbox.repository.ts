import { Prisma } from '../../generated/prisma/client.js';

type RawQueryable = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
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
}

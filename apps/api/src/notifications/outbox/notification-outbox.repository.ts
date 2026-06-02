import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';

type RawQueryable = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

type OutboxMutableClient = {
  notificationOutboxEvent: {
    update(args: unknown): Promise<unknown>;
  };
};

export type ClaimedNotificationOutboxEvent = {
  id: string;
  notificationId: string;
  recipientUserId: string;
  eventType: string;
  schemaVersion: number;
  payload: unknown;
  createdAt: Date;
  publishAttempts: number;
};

export class NotificationOutboxRepository {
  async claimPublishableBatch(
    prisma: RawQueryable,
    input: { limit: number; now: Date; claimLeaseMs: number; lockedBy?: string },
  ): Promise<ClaimedNotificationOutboxEvent[]> {
    const safeLimit = Math.max(1, Math.min(input.limit, 100));
    const lockedBy = input.lockedBy ?? `notification-dispatcher-${randomUUID()}`;
    const staleLockedBefore = new Date(input.now.getTime() - input.claimLeaseMs);

    return prisma.$queryRaw<ClaimedNotificationOutboxEvent[]>(Prisma.sql`
      WITH picked AS (
        SELECT "id"
        FROM "NotificationOutboxEvent"
        WHERE "status" IN ('PENDING', 'FAILED')
          AND "availableAt" <= ${input.now}
          AND ("lockedAt" IS NULL OR "lockedAt" <= ${staleLockedBefore})
        ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationOutboxEvent" AS event
      SET "status" = 'PENDING',
          "lockedAt" = ${input.now},
          "lockedBy" = ${lockedBy},
          "publishAttempts" = event."publishAttempts" + 1,
          "updatedAt" = ${input.now}
      FROM picked
      WHERE event."id" = picked."id"
      RETURNING
        event."id",
        event."notificationId",
        event."recipientUserId",
        event."eventType",
        event."schemaVersion",
        event."payload",
        event."createdAt",
        event."publishAttempts"
    `);
  }

  async markPublished(
    prisma: OutboxMutableClient,
    input: { eventId: string; now: Date },
  ): Promise<void> {
    await prisma.notificationOutboxEvent.update({
      where: { id: input.eventId },
      data: {
        status: 'PUBLISHED',
        publishedAt: input.now,
        failedAt: null,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        updatedAt: input.now,
      },
    });
  }

  async markPublishFailed(
    prisma: OutboxMutableClient,
    input: { eventId: string; now: Date; nextAvailableAt: Date; error: string },
  ): Promise<void> {
    await prisma.notificationOutboxEvent.update({
      where: { id: input.eventId },
      data: {
        status: 'FAILED',
        availableAt: input.nextAvailableAt,
        failedAt: input.now,
        lastError: input.error.slice(0, 1_000),
        lockedAt: null,
        lockedBy: null,
        updatedAt: input.now,
      },
    });
  }
}

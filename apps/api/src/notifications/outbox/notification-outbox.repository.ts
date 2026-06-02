import { randomUUID } from 'node:crypto';
import { claimNotificationOutboxEvents } from '../../generated/prisma/sql.js';

type TypedQueryable = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
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
    prisma: TypedQueryable,
    input: { limit: number; now: Date; claimLeaseMs: number; lockedBy?: string },
  ): Promise<ClaimedNotificationOutboxEvent[]> {
    const safeLimit = Math.max(1, Math.min(input.limit, 100));
    const lockedBy = input.lockedBy ?? `notification-dispatcher-${randomUUID()}`;
    const staleLockedBefore = new Date(input.now.getTime() - input.claimLeaseMs);

    return prisma.$queryRawTyped<claimNotificationOutboxEvents.Result>(
      claimNotificationOutboxEvents(input.now, staleLockedBefore, lockedBy, safeLimit),
    );
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

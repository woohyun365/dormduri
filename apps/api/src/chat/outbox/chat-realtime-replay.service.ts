import { Prisma } from '../../generated/prisma/client.js';
import { isChatRealtimePayloadPrivacySafe } from '../realtime/chat-realtime-event.mapper.js';

type RawQueryable = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

type CursorRow = {
  cursor: string;
  createdAt: Date;
  eventId: string;
};

type ReplayRow = {
  eventId: string;
  cursor: string;
  eventType: string;
  schemaVersion: number;
  threadId: string | null;
  payload: unknown;
  occurredAt: Date;
  recipientCreatedAt: Date;
};

type ReplayOk = {
  status: 'ok';
  events: Array<{
    eventId: string;
    cursor: string;
    eventType: string;
    schemaVersion: number;
    threadId: string | null;
    payload: unknown;
    occurredAt: string;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
};

type ReplayResyncRequired = {
  status: 'resync_required';
  reason: 'CURSOR_EXPIRED' | 'CURSOR_INVALID' | 'PRIVACY_GUARD';
};

export class ChatRealtimeReplayService {
  private readonly replayWindowDays: number;

  constructor(deps: { replayWindowDays?: number } = {}) {
    this.replayWindowDays = deps.replayWindowDays ?? 7;
  }

  async getReplayEvents(
    prisma: RawQueryable,
    input: { userId: string; after?: string | null; limit: number; now: Date },
  ): Promise<ReplayOk | ReplayResyncRequired> {
    const windowStart = new Date(input.now.getTime() - this.replayWindowDays * 24 * 60 * 60 * 1000);
    const safeLimit = Math.max(1, Math.min(input.limit, 100));

    let afterRow: CursorRow | null = null;
    if (input.after) {
      const rows = await prisma.$queryRaw<CursorRow[]>(Prisma.sql`
        SELECT "cursor", "createdAt", "eventId"
        FROM "ChatRealtimeEventRecipient"
        WHERE "userId" = ${input.userId}
          AND "cursor" = ${input.after}
        LIMIT 1
      `);
      afterRow = rows[0] ?? null;

      if (!afterRow) {
        return { status: 'resync_required', reason: 'CURSOR_INVALID' };
      }
      if (afterRow.createdAt < windowStart) {
        return { status: 'resync_required', reason: 'CURSOR_EXPIRED' };
      }
    }

    const rows = await prisma.$queryRaw<ReplayRow[]>(Prisma.sql`
      SELECT
        recipient."eventId" AS "eventId",
        recipient."cursor" AS "cursor",
        event."eventType" AS "eventType",
        event."schemaVersion" AS "schemaVersion",
        event."threadId" AS "threadId",
        event."payload" AS "payload",
        event."occurredAt" AS "occurredAt",
        recipient."createdAt" AS "recipientCreatedAt"
      FROM "ChatRealtimeEventRecipient" AS recipient
      INNER JOIN "ChatRealtimeOutboxEvent" AS event ON event."id" = recipient."eventId"
      WHERE recipient."userId" = ${input.userId}
        AND recipient."createdAt" >= ${windowStart}
        AND (
          ${afterRow?.createdAt ?? null}::timestamptz IS NULL
          OR (recipient."createdAt", recipient."eventId") > (${afterRow?.createdAt ?? null}::timestamptz, ${afterRow?.eventId ?? ''})
        )
      ORDER BY recipient."createdAt" ASC, recipient."eventId" ASC
      LIMIT ${safeLimit + 1}
    `);

    const page = rows.slice(0, safeLimit);
    if (page.some((row) => !isChatRealtimePayloadPrivacySafe(row.payload))) {
      return { status: 'resync_required', reason: 'PRIVACY_GUARD' };
    }

    const nextCursor = page.at(-1)?.cursor ?? input.after ?? null;

    return {
      status: 'ok',
      events: page.map((row) => ({
        eventId: row.eventId,
        cursor: row.cursor,
        eventType: row.eventType,
        schemaVersion: row.schemaVersion,
        threadId: row.threadId,
        payload: row.payload,
        occurredAt: row.occurredAt.toISOString(),
      })),
      nextCursor,
      hasMore: rows.length > safeLimit,
    };
  }
}

import {
  findChatRealtimeReplayCursor,
  findChatRealtimeReplayEvents,
} from '../../generated/prisma/sql.js';
import { isChatRealtimePayloadPrivacySafe } from '../events/chat-realtime-event.mapper.js';

type TypedQueryable = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
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
    prisma: TypedQueryable,
    input: { userId: string; after?: string | null; limit: number; now: Date },
  ): Promise<ReplayOk | ReplayResyncRequired> {
    const windowStart = new Date(input.now.getTime() - this.replayWindowDays * 24 * 60 * 60 * 1000);
    const safeLimit = Math.max(1, Math.min(input.limit, 100));

    let afterRow: CursorRow | null = null;
    if (input.after) {
      const rows = await prisma.$queryRawTyped<CursorRow>(
        findChatRealtimeReplayCursor(input.userId, input.after),
      );
      afterRow = rows[0] ?? null;

      if (!afterRow) {
        return { status: 'resync_required', reason: 'CURSOR_INVALID' };
      }
      if (afterRow.createdAt < windowStart) {
        return { status: 'resync_required', reason: 'CURSOR_EXPIRED' };
      }
    }

    const rows = await prisma.$queryRawTyped<ReplayRow>(
      findChatRealtimeReplayEvents(
        input.userId,
        windowStart,
        Boolean(afterRow),
        afterRow?.createdAt ?? windowStart,
        afterRow?.eventId ?? '',
        safeLimit + 1,
      ),
    );

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

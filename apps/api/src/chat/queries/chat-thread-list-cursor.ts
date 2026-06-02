import {
  OpaqueTokenError,
  signOpaqueHmacToken,
  verifyOpaqueHmacToken,
} from '../../common/security/opaque-hmac-token.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';

export const CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV = 'CHAT_THREAD_LIST_CURSOR_HMAC_SECRET';
export const DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET = 'local-chat-thread-list-cursor-secret';

const CHAT_THREAD_LIST_CURSOR_TTL_MS = 10 * 60 * 1000;

export type ChatThreadListCursorBoundary = {
  lastMessageAt: Date | null;
  createdAt: Date;
  threadId: string;
};

type ChatThreadListCursorPayload = {
  v: 1;
  purpose: 'CHAT_THREAD_LIST_CURSOR';
  viewerUserId: string;
  after: {
    lastMessageAt: string | null;
    createdAt: string;
    threadId: string;
  };
  issuedAt: number;
  expiresAt: number;
};

export function createChatThreadListCursorOwner(
  secret = readChatThreadListCursorSecret(process.env),
) {
  return {
    signCursor(input: {
      viewerUserId: string;
      after: ChatThreadListCursorBoundary;
      now: Date;
    }): string {
      const issuedAt = input.now.getTime();
      return signOpaqueHmacToken(
        {
          v: 1,
          purpose: 'CHAT_THREAD_LIST_CURSOR',
          viewerUserId: input.viewerUserId,
          after: serializeBoundary(input.after),
          issuedAt,
          expiresAt: issuedAt + CHAT_THREAD_LIST_CURSOR_TTL_MS,
        } satisfies ChatThreadListCursorPayload,
        secret,
      );
    },

    verifyCursor(input: {
      cursor: string;
      viewerUserId: string;
      now: Date;
    }): ChatThreadListCursorBoundary {
      const payload = verifyOpaqueHmacToken(input.cursor, secret);
      const parsed = parsePayload(payload);
      if (
        parsed.viewerUserId !== input.viewerUserId ||
        parsed.expiresAt < input.now.getTime() ||
        parsed.issuedAt > input.now.getTime() + 60_000
      ) {
        throw new OpaqueTokenError('Invalid chat thread list cursor scope.');
      }

      return parseBoundary(parsed.after);
    },
  };
}

export function buildChatThreadListCursorBoundary(
  thread: Pick<ThreadRecord, 'createdAt' | 'id' | 'lastMessageAt'>,
): ChatThreadListCursorBoundary {
  return {
    lastMessageAt: thread.lastMessageAt,
    createdAt: thread.createdAt,
    threadId: thread.id,
  };
}

function serializeBoundary(boundary: ChatThreadListCursorBoundary) {
  return {
    lastMessageAt: boundary.lastMessageAt?.toISOString() ?? null,
    createdAt: boundary.createdAt.toISOString(),
    threadId: boundary.threadId,
  };
}

function parseBoundary(boundary: ChatThreadListCursorPayload['after']) {
  const createdAt = parseDate(boundary.createdAt);
  const lastMessageAt = boundary.lastMessageAt ? parseDate(boundary.lastMessageAt) : null;
  if (!createdAt || (boundary.lastMessageAt && !lastMessageAt)) {
    throw new OpaqueTokenError('Invalid chat thread list cursor boundary.');
  }

  return {
    lastMessageAt,
    createdAt,
    threadId: boundary.threadId,
  };
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePayload(payload: unknown): ChatThreadListCursorPayload {
  if (!payload || typeof payload !== 'object') {
    throw new OpaqueTokenError('Invalid chat thread list cursor payload.');
  }

  const candidate = payload as Partial<ChatThreadListCursorPayload>;
  if (
    candidate.v !== 1 ||
    candidate.purpose !== 'CHAT_THREAD_LIST_CURSOR' ||
    typeof candidate.viewerUserId !== 'string' ||
    typeof candidate.issuedAt !== 'number' ||
    typeof candidate.expiresAt !== 'number' ||
    !candidate.after ||
    typeof candidate.after !== 'object' ||
    typeof candidate.after.createdAt !== 'string' ||
    typeof candidate.after.threadId !== 'string' ||
    (candidate.after.lastMessageAt !== null && typeof candidate.after.lastMessageAt !== 'string')
  ) {
    throw new OpaqueTokenError('Invalid chat thread list cursor payload.');
  }

  return candidate as ChatThreadListCursorPayload;
}

function readChatThreadListCursorSecret(env: NodeJS.ProcessEnv) {
  return (
    env[CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV]?.trim() ||
    DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET
  );
}

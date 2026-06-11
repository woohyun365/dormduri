import {
  OpaqueTokenError,
  signOpaqueHmacToken,
  verifyOpaqueHmacToken,
} from '../../platform/security/opaque-hmac-token.js';

export const NOTIFICATION_LIST_CURSOR_HMAC_SECRET_ENV = 'NOTIFICATION_LIST_CURSOR_HMAC_SECRET';
export const DEFAULT_NOTIFICATION_LIST_CURSOR_HMAC_SECRET = 'local-notification-list-cursor-secret';

const NOTIFICATION_LIST_CURSOR_TTL_MS = 10 * 60 * 1000;

export type NotificationListCursorBoundary = {
  createdAt: Date;
  notificationId: string;
};

type NotificationListCursorPayload = {
  v: 1;
  purpose: 'NOTIFICATION_LIST_CURSOR';
  viewerUserId: string;
  after: {
    createdAt: string;
    notificationId: string;
  };
  issuedAt: number;
  expiresAt: number;
};

export function createNotificationListCursorOwner(
  secret = readNotificationListCursorSecret(process.env),
) {
  return {
    signCursor(input: {
      viewerUserId: string;
      after: NotificationListCursorBoundary;
      now: Date;
    }): string {
      const issuedAt = input.now.getTime();
      return signOpaqueHmacToken(
        {
          v: 1,
          purpose: 'NOTIFICATION_LIST_CURSOR',
          viewerUserId: input.viewerUserId,
          after: {
            createdAt: input.after.createdAt.toISOString(),
            notificationId: input.after.notificationId,
          },
          issuedAt,
          expiresAt: issuedAt + NOTIFICATION_LIST_CURSOR_TTL_MS,
        } satisfies NotificationListCursorPayload,
        secret,
      );
    },

    verifyCursor(input: {
      cursor: string;
      viewerUserId: string;
      now: Date;
    }): NotificationListCursorBoundary {
      const payload = verifyOpaqueHmacToken(input.cursor, secret);
      const parsed = parsePayload(payload);
      if (
        parsed.viewerUserId !== input.viewerUserId ||
        parsed.expiresAt < input.now.getTime() ||
        parsed.issuedAt > input.now.getTime() + 60_000
      ) {
        throw new OpaqueTokenError('Invalid notification list cursor scope.');
      }

      const createdAt = parseDate(parsed.after.createdAt);
      if (!createdAt) {
        throw new OpaqueTokenError('Invalid notification list cursor boundary.');
      }

      return {
        createdAt,
        notificationId: parsed.after.notificationId,
      };
    },
  };
}

function parsePayload(payload: unknown): NotificationListCursorPayload {
  if (!payload || typeof payload !== 'object') {
    throw new OpaqueTokenError('Invalid notification list cursor payload.');
  }

  const candidate = payload as Partial<NotificationListCursorPayload>;
  if (
    candidate.v !== 1 ||
    candidate.purpose !== 'NOTIFICATION_LIST_CURSOR' ||
    typeof candidate.viewerUserId !== 'string' ||
    typeof candidate.issuedAt !== 'number' ||
    typeof candidate.expiresAt !== 'number' ||
    !candidate.after ||
    typeof candidate.after !== 'object' ||
    typeof candidate.after.createdAt !== 'string' ||
    typeof candidate.after.notificationId !== 'string'
  ) {
    throw new OpaqueTokenError('Invalid notification list cursor payload.');
  }

  return candidate as NotificationListCursorPayload;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readNotificationListCursorSecret(env: NodeJS.ProcessEnv) {
  return (
    env[NOTIFICATION_LIST_CURSOR_HMAC_SECRET_ENV]?.trim() ||
    DEFAULT_NOTIFICATION_LIST_CURSOR_HMAC_SECRET
  );
}

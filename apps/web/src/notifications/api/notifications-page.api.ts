import {
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationListResponseSchema,
  notificationUnreadCountResponseSchema,
  type ListNotificationsQuery,
  type MarkAllNotificationsReadResponse,
  type MarkNotificationReadResponse,
  type NotificationListResponse,
  type NotificationUnreadCountResponse,
} from '@repo/shared/notifications';

export class NotificationsPageFetchError extends Error {
  constructor(
    public readonly code: 'NOTIFICATIONS_UPSTREAM_UNAVAILABLE' | 'NOTIFICATIONS_UPSTREAM_INVALID',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'NotificationsPageFetchError';
  }
}

type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

type QueryValue = string | number | boolean | null | undefined;

function buildQueryString(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new NotificationsPageFetchError(
      'NOTIFICATIONS_UPSTREAM_INVALID',
      'Notification response is not JSON.',
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new NotificationsPageFetchError(
      'NOTIFICATIONS_UPSTREAM_INVALID',
      'Notification response JSON is malformed.',
      response.status,
    );
  }
}

async function fetchAndParse<T>(path: string, schema: Schema<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
      ...init,
    });
  } catch {
    throw new NotificationsPageFetchError(
      'NOTIFICATIONS_UPSTREAM_UNAVAILABLE',
      'Notification request failed.',
    );
  }

  if (!response.ok) {
    throw new NotificationsPageFetchError(
      'NOTIFICATIONS_UPSTREAM_UNAVAILABLE',
      'Notification upstream returned an error status.',
      response.status,
    );
  }

  const json = await readJson(response);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new NotificationsPageFetchError(
      'NOTIFICATIONS_UPSTREAM_INVALID',
      'Notification response did not match the public contract.',
    );
  }
  return parsed.data;
}

function buildNotificationListPath(query: Partial<ListNotificationsQuery> = {}): string {
  return `/api/notifications${buildQueryString({ limit: query.limit, cursor: query.cursor })}`;
}

async function listNotifications(
  query: Partial<ListNotificationsQuery> = {},
): Promise<NotificationListResponse> {
  return fetchAndParse(buildNotificationListPath(query), notificationListResponseSchema);
}

async function getUnreadCount(): Promise<NotificationUnreadCountResponse> {
  return fetchAndParse('/api/notifications/unread-count', notificationUnreadCountResponseSchema);
}

async function markRead(notificationId: string): Promise<MarkNotificationReadResponse> {
  return fetchAndParse(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    markNotificationReadResponseSchema,
    { method: 'POST' },
  );
}

async function markAllRead(): Promise<MarkAllNotificationsReadResponse> {
  return fetchAndParse('/api/notifications/read-all', markAllNotificationsReadResponseSchema, {
    method: 'POST',
  });
}

export const notificationsPageApi = {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};

import {
  globalNoticeListResponseSchema,
  type GlobalNoticeListResponse,
  type ListGlobalNoticesQuery,
} from '@repo/shared/notices';
import {
  notificationListResponseSchema,
  notificationUnreadCountResponseSchema,
  type ListNotificationsQuery,
  type NotificationListResponse,
  type NotificationUnreadCountResponse,
} from '@repo/shared/notifications';
import {
  listSupportFaqQuerySchema,
  listSupportTicketsQuerySchema,
  supportFaqListResponseSchema,
  supportTicketListResponseSchema,
  type ListSupportFaqQuery,
  type ListSupportTicketsQuery,
  type SupportFaqListResponse,
  type SupportTicketListResponse,
} from '@repo/shared/support';
export class HomeOperationsFetchError extends Error {
  constructor(
    public readonly code:
      | 'HOME_OPERATIONS_UPSTREAM_UNAVAILABLE'
      | 'HOME_OPERATIONS_UPSTREAM_INVALID',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HomeOperationsFetchError';
  }
}

type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

type QueryValue = string | number | boolean | null | undefined;

function buildQueryString(query: Record<string, QueryValue>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    searchParams.set(key, String(value));
  }
  const search = searchParams.toString();
  return search ? `?${search}` : '';
}

async function readOperationsJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new HomeOperationsFetchError(
      'HOME_OPERATIONS_UPSTREAM_INVALID',
      'Home operations response is not JSON.',
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new HomeOperationsFetchError(
      'HOME_OPERATIONS_UPSTREAM_INVALID',
      'Home operations response JSON is malformed.',
      response.status,
    );
  }
}

async function fetchOperationsJson(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      cache: 'no-store',
      ...init,
    });
  } catch {
    throw new HomeOperationsFetchError(
      'HOME_OPERATIONS_UPSTREAM_UNAVAILABLE',
      'Home operations request failed.',
    );
  }

  if (!response.ok) {
    throw new HomeOperationsFetchError(
      'HOME_OPERATIONS_UPSTREAM_UNAVAILABLE',
      'Home operations upstream returned an error status.',
      response.status,
    );
  }

  return readOperationsJson(response);
}

async function fetchAndParse<T>(path: string, schema: Schema<T>, init?: RequestInit): Promise<T> {
  const json = await fetchOperationsJson(path, init);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HomeOperationsFetchError(
      'HOME_OPERATIONS_UPSTREAM_INVALID',
      'Home operations response did not match the public contract.',
    );
  }
  return parsed.data;
}

function buildGlobalNoticeListPath(query: Partial<ListGlobalNoticesQuery> = {}) {
  return `/api/notices${buildQueryString({
    limit: query.limit,
    cursor: query.cursor,
    severity: query.severity,
    relatedSeasonId: query.relatedSeasonId,
  })}`;
}

function buildNotificationListPath(query: Partial<ListNotificationsQuery> = {}) {
  return `/api/notifications${buildQueryString({ limit: query.limit, cursor: query.cursor })}`;
}

function buildSupportFaqPath(query: Partial<ListSupportFaqQuery> = {}) {
  const parsed = listSupportFaqQuerySchema.parse(query);
  return `/api/support/faq${buildQueryString({
    category: parsed.category,
    surface: parsed.surface,
  })}`;
}

function buildSupportTicketListPath(query: Partial<ListSupportTicketsQuery> = {}) {
  const parsed = listSupportTicketsQuerySchema.parse(query);
  return `/api/support/tickets${buildQueryString({
    status: parsed.status,
    category: parsed.category,
    cursor: parsed.cursor,
    limit: parsed.limit,
  })}`;
}

async function listGlobalNotices(
  query: Partial<ListGlobalNoticesQuery> = {},
): Promise<GlobalNoticeListResponse> {
  return fetchAndParse(buildGlobalNoticeListPath(query), globalNoticeListResponseSchema);
}

async function listNotifications(
  query: Partial<ListNotificationsQuery> = {},
): Promise<NotificationListResponse> {
  return fetchAndParse(buildNotificationListPath(query), notificationListResponseSchema);
}

async function getNotificationUnreadCount(): Promise<NotificationUnreadCountResponse> {
  return fetchAndParse('/api/notifications/unread-count', notificationUnreadCountResponseSchema);
}

async function listSupportFaq(
  query: Partial<ListSupportFaqQuery> = { surface: 'SUPPORT_CENTER' },
): Promise<SupportFaqListResponse> {
  return fetchAndParse(buildSupportFaqPath(query), supportFaqListResponseSchema);
}

async function listSupportTickets(
  query: Partial<ListSupportTicketsQuery> = {},
): Promise<SupportTicketListResponse> {
  return fetchAndParse(buildSupportTicketListPath(query), supportTicketListResponseSchema);
}

export const homeOperationsApi = {
  listGlobalNotices,
  listNotifications,
  getNotificationUnreadCount,
  listSupportFaq,
  listSupportTickets,
};

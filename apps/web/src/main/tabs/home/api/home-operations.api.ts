import {
  notificationUnreadCountResponseSchema,
  type NotificationUnreadCountResponse,
} from '@repo/shared/notifications';

export class HomeOperationsFetchError extends Error {
  constructor(
    public readonly code:
      'HOME_OPERATIONS_UPSTREAM_UNAVAILABLE' | 'HOME_OPERATIONS_UPSTREAM_INVALID',
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

async function getNotificationUnreadCount(): Promise<NotificationUnreadCountResponse> {
  return fetchAndParse('/api/notifications/unread-count', notificationUnreadCountResponseSchema);
}

export const homeOperationsApi = {
  getNotificationUnreadCount,
};

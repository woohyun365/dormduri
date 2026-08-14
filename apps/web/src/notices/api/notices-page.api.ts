import {
  globalNoticeDetailResponseSchema,
  globalNoticeListResponseSchema,
  type GlobalNoticeDetailResponse,
  type GlobalNoticeListResponse,
  type ListGlobalNoticesQuery,
} from '@repo/shared/notices';

export class NoticesPageFetchError extends Error {
  constructor(
    public readonly code: 'NOTICES_UPSTREAM_UNAVAILABLE' | 'NOTICES_UPSTREAM_INVALID',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'NoticesPageFetchError';
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
    throw new NoticesPageFetchError(
      'NOTICES_UPSTREAM_INVALID',
      'Notice response is not JSON.',
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new NoticesPageFetchError(
      'NOTICES_UPSTREAM_INVALID',
      'Notice response JSON is malformed.',
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
    throw new NoticesPageFetchError('NOTICES_UPSTREAM_UNAVAILABLE', 'Notice request failed.');
  }

  if (!response.ok) {
    throw new NoticesPageFetchError(
      'NOTICES_UPSTREAM_UNAVAILABLE',
      'Notice upstream returned an error status.',
      response.status,
    );
  }

  const json = await readJson(response);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new NoticesPageFetchError(
      'NOTICES_UPSTREAM_INVALID',
      'Notice response did not match the public contract.',
    );
  }
  return parsed.data;
}

function buildNoticeListPath(query: Partial<ListGlobalNoticesQuery> = {}): string {
  return `/api/notices${buildQueryString({
    limit: query.limit,
    cursor: query.cursor,
    severity: query.severity,
    relatedSeasonId: query.relatedSeasonId,
  })}`;
}

async function listNotices(
  query: Partial<ListGlobalNoticesQuery> = {},
): Promise<GlobalNoticeListResponse> {
  return fetchAndParse(buildNoticeListPath(query), globalNoticeListResponseSchema);
}

async function getNotice(noticeId: string): Promise<GlobalNoticeDetailResponse> {
  return fetchAndParse(
    `/api/notices/${encodeURIComponent(noticeId)}`,
    globalNoticeDetailResponseSchema,
  );
}

export const noticesPageApi = {
  listNotices,
  getNotice,
};

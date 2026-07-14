import {
  bookmarkListResponseSchema,
  createBookmarkResponseSchema,
  deleteBookmarkResponseSchema,
  type BookmarkListResponse,
  type BookmarkSort,
  type CreateBookmarkResponse,
  type DeleteBookmarkResponse,
} from '@repo/shared/social-safety/bookmark';
import {
  createBlockResponseSchema,
  type CreateBlockRequest,
  type CreateBlockResponse,
} from '@repo/shared/social-safety/block';
import {
  createReportResponseSchema,
  type CreateReportRequest,
  type CreateReportResponse,
} from '@repo/shared/social-safety/report';
import {
  matchRequestActionResponseSchema,
  type CreateMatchRequestRequest,
  type MatchRequestActionResponse,
} from '@repo/shared/match/contract';
import {
  createRoommateApiError,
  isRoommateApiError,
  normalizeRoommateApiErrorCode,
} from './roommateApiErrors';
import type { RoommateSearchRequestOptions } from './roommateSearch.client';

export interface BookmarkListQueryParams {
  readonly sort?: BookmarkSort;
  readonly cursor?: string | null;
  readonly limit?: number | null;
}

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

type RoommateActionPath =
  | '/api/bookmarks'
  | `/api/bookmarks/${string}`
  | `/api/blocks/${string}`
  | '/api/reports'
  | '/api/matches/requests';

function buildBookmarkListQuery(query?: BookmarkListQueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.sort) params.set('sort', query.sort);
  if (typeof query.cursor === 'string' && query.cursor.trim() !== '') {
    params.set('cursor', query.cursor);
  }
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readSafeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw createRoommateApiError({
      code: 'ROOMMATE_ACTION_SCHEMA_INVALID',
      status: response.status,
    });
  }
}

async function fetchRoommateActionJson<T>(input: {
  path: RoommateActionPath;
  method: 'GET' | 'POST' | 'DELETE';
  schema: SafeParseSchema<T>;
  query?: string;
  body?: unknown;
  options?: RoommateSearchRequestOptions;
}): Promise<T> {
  let response: Response;
  const hasBody = input.body !== undefined;
  try {
    response = await fetch(`${input.path}${input.query ?? ''}`, {
      method: input.method,
      cache: 'no-store',
      ...(hasBody
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input.body),
          }
        : {}),
      signal: input.options?.signal,
    });
  } catch (error) {
    if (isRoommateApiError(error)) throw error;
    throw createRoommateApiError({ code: 'ROOMMATE_ACTION_NETWORK_ERROR' });
  }

  const json = await readSafeJson(response);

  if (!response.ok) {
    const code = isRecord(json)
      ? normalizeRoommateApiErrorCode(json.code, 'UNKNOWN_ROOMMATE_ACTION_ERROR')
      : 'UNKNOWN_ROOMMATE_ACTION_ERROR';
    throw createRoommateApiError({ code, status: response.status });
  }

  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    throw createRoommateApiError({
      code: 'ROOMMATE_ACTION_SCHEMA_INVALID',
      status: response.status,
    });
  }

  return parsed.data;
}

export function getRoommateBookmarkList(
  query?: BookmarkListQueryParams,
  options?: RoommateSearchRequestOptions,
): Promise<BookmarkListResponse> {
  return fetchRoommateActionJson({
    path: '/api/bookmarks',
    method: 'GET',
    query: buildBookmarkListQuery(query),
    schema: bookmarkListResponseSchema,
    options,
  });
}

export function createRoommateBookmark(
  targetUserId: string,
  options?: RoommateSearchRequestOptions,
): Promise<CreateBookmarkResponse> {
  return fetchRoommateActionJson({
    path: `/api/bookmarks/${encodeURIComponent(targetUserId)}`,
    method: 'POST',
    schema: createBookmarkResponseSchema,
    options,
  });
}

export function deleteRoommateBookmark(
  targetUserId: string,
  options?: RoommateSearchRequestOptions,
): Promise<DeleteBookmarkResponse> {
  return fetchRoommateActionJson({
    path: `/api/bookmarks/${encodeURIComponent(targetUserId)}`,
    method: 'DELETE',
    schema: deleteBookmarkResponseSchema,
    options,
  });
}

export function createRoommateBlock(
  targetUserId: string,
  body: CreateBlockRequest,
  options?: RoommateSearchRequestOptions,
): Promise<CreateBlockResponse> {
  return fetchRoommateActionJson({
    path: `/api/blocks/${encodeURIComponent(targetUserId)}`,
    method: 'POST',
    body,
    schema: createBlockResponseSchema,
    options,
  });
}

export function createRoommateReport(
  body: CreateReportRequest,
  options?: RoommateSearchRequestOptions,
): Promise<CreateReportResponse> {
  return fetchRoommateActionJson({
    path: '/api/reports',
    method: 'POST',
    body,
    schema: createReportResponseSchema,
    options,
  });
}

export function createRoommateMatchRequest(
  body: CreateMatchRequestRequest,
  options?: RoommateSearchRequestOptions,
): Promise<MatchRequestActionResponse> {
  return fetchRoommateActionJson({
    path: '/api/matches/requests',
    method: 'POST',
    body,
    schema: matchRequestActionResponseSchema,
    options,
  });
}

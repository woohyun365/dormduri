import {
  roommateSearchManifestResponseSchema,
  roommateSearchResponseSchema,
  type RoommateSearchManifestResponse,
  type RoommateSearchResponse,
} from '@repo/shared/roommate-search/contract';
import {
  createRoommateApiError,
  isRoommateApiError,
  normalizeRoommateApiErrorCode,
} from './roommateApiErrors';
export { isRoommateApiError } from './roommateApiErrors';
export type { RoommateApiError, RoommateApiErrorCode } from './roommateApiErrors';

type QueryValue = string | number | boolean;
type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};
export interface RoommateSearchRequestOptions {
  readonly signal?: AbortSignal;
}
export type RoommateSearchQueryParams =
  | URLSearchParams
  | Record<string, QueryValue | readonly QueryValue[] | null | undefined>;

function appendQueryValue(params: URLSearchParams, key: string, value: QueryValue): void {
  params.append(key, String(value));
}

function isQueryValueArray(
  value: QueryValue | readonly QueryValue[],
): value is readonly QueryValue[] {
  return Array.isArray(value);
}

function buildQueryString(query?: RoommateSearchQueryParams): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => {
      params.append(key, value);
    });
  } else {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (isQueryValueArray(value)) {
        for (const item of value) {
          appendQueryValue(params, key, item);
        }
        continue;
      }

      appendQueryValue(params, key, value);
    }
  }

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readSafeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw createRoommateApiError({
      code: 'ROOMMATE_SEARCH_SCHEMA_INVALID',
      status: response.status,
    });
  }
}

async function fetchRoommateJson<T>(input: {
  path: '/api/roommate-search' | '/api/roommate-search/manifest';
  query?: RoommateSearchQueryParams;
  schema: SafeParseSchema<T>;
  options?: RoommateSearchRequestOptions;
}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${input.path}${buildQueryString(input.query)}`, {
      cache: 'no-store',
      signal: input.options?.signal,
    });
  } catch (error) {
    if (isRoommateApiError(error)) {
      throw error;
    }
    throw createRoommateApiError({ code: 'ROOMMATE_SEARCH_NETWORK_ERROR' });
  }

  const json = await readSafeJson(response);

  if (!response.ok) {
    const code = isRecord(json)
      ? normalizeRoommateApiErrorCode(json.code)
      : 'UNKNOWN_ROOMMATE_SEARCH_ERROR';
    throw createRoommateApiError({ code, status: response.status });
  }

  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    throw createRoommateApiError({
      code: 'ROOMMATE_SEARCH_SCHEMA_INVALID',
      status: response.status,
    });
  }

  return parsed.data;
}

export function getRoommateSearch(
  query?: RoommateSearchQueryParams,
  options?: RoommateSearchRequestOptions,
): Promise<RoommateSearchResponse> {
  return fetchRoommateJson({
    path: '/api/roommate-search',
    query,
    schema: roommateSearchResponseSchema,
    options,
  });
}

export function getRoommateSearchManifest(
  query?: RoommateSearchQueryParams,
  options?: RoommateSearchRequestOptions,
): Promise<RoommateSearchManifestResponse> {
  return fetchRoommateJson({
    path: '/api/roommate-search/manifest',
    query,
    schema: roommateSearchManifestResponseSchema,
    options,
  });
}

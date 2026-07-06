import { publicProfileSchema, type PublicProfile } from '@repo/shared/profile/contract';
import {
  createRoommateApiError,
  isRoommateApiError,
  normalizeRoommateApiErrorCode,
} from './roommateApiErrors';
import type { RoommateSearchRequestOptions } from './roommateSearch.client';

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

export interface RoommateProfileDetailQuery {
  readonly targetUserId: string;
  readonly detailEntryToken: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readSafeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw createRoommateApiError({
      code: 'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID',
      status: response.status,
    });
  }
}

async function fetchRoommateProfileDetailJson<T>(input: {
  readonly path: string;
  readonly schema: SafeParseSchema<T>;
  readonly options?: RoommateSearchRequestOptions;
}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input.path, {
      cache: 'no-store',
      signal: input.options?.signal,
    });
  } catch (error) {
    if (isRoommateApiError(error)) throw error;
    throw createRoommateApiError({ code: 'ROOMMATE_PROFILE_DETAIL_NETWORK_ERROR' });
  }

  const json = await readSafeJson(response);

  if (!response.ok) {
    const code = isRecord(json)
      ? normalizeRoommateApiErrorCode(json.code, 'UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR')
      : 'UNKNOWN_ROOMMATE_PROFILE_DETAIL_ERROR';
    throw createRoommateApiError({ code, status: response.status });
  }

  const parsed = input.schema.safeParse(json);
  if (!parsed.success) {
    throw createRoommateApiError({
      code: 'ROOMMATE_PROFILE_DETAIL_SCHEMA_INVALID',
      status: response.status,
    });
  }

  return parsed.data;
}

export function getRoommateProfileDetail(
  query: RoommateProfileDetailQuery,
  options?: RoommateSearchRequestOptions,
): Promise<PublicProfile> {
  const targetUserId = query.targetUserId.trim();
  const detailEntryToken = query.detailEntryToken.trim();

  if (!targetUserId || !detailEntryToken) {
    return Promise.reject(
      createRoommateApiError({ code: 'ROOMMATE_PROFILE_DETAIL_ENTRY_REQUIRED', status: 400 }),
    );
  }

  const params = new URLSearchParams({ detailEntryToken });
  return fetchRoommateProfileDetailJson({
    path: `/api/profiles/${encodeURIComponent(targetUserId)}?${params.toString()}`,
    schema: publicProfileSchema,
    options,
  });
}

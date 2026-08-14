import { publicProfileSchema, type PublicProfile } from '@repo/shared/profile/contract';
import {
  previousSeasonProfileResponseSchema,
  seasonProfileDraftResponseSchema,
  type PreviousSeasonProfileResponse,
  type SeasonProfileDraftResponse,
} from '@repo/shared/season/participation';

export class HomeProfileDetailFetchError extends Error {
  constructor(
    public readonly code:
      | 'HOME_PROFILE_DETAIL_UPSTREAM_UNAVAILABLE'
      | 'HOME_PROFILE_DETAIL_UPSTREAM_INVALID',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HomeProfileDetailFetchError';
  }
}

async function readHomeProfileDetailJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_INVALID',
      'Home profile detail response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_INVALID',
      'Home profile detail response JSON is malformed.',
    );
  }
}

async function fetchJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_UNAVAILABLE',
      'Home profile detail request failed.',
    );
  }

  if (!response.ok) {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_UNAVAILABLE',
      'Home profile detail upstream returned an error status.',
      response.status,
    );
  }

  return readHomeProfileDetailJson(response);
}

async function getCurrentSeasonProfile(): Promise<SeasonProfileDraftResponse> {
  const parsed = seasonProfileDraftResponseSchema.safeParse(
    await fetchJson('/api/seasons/current/profile'),
  );
  if (!parsed.success) {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_INVALID',
      'Current season profile response did not match the public contract.',
    );
  }

  return parsed.data;
}

async function getPreviousSeasonProfile(): Promise<PreviousSeasonProfileResponse> {
  const parsed = previousSeasonProfileResponseSchema.safeParse(
    await fetchJson('/api/seasons/previous/profile'),
  );
  if (!parsed.success) {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_INVALID',
      'Previous season profile response did not match the public contract.',
    );
  }

  return parsed.data;
}

async function getPublicProfileByUserId(userId: string): Promise<PublicProfile> {
  const parsed = publicProfileSchema.safeParse(
    await fetchJson(`/api/profiles/${encodeURIComponent(userId)}`),
  );
  if (!parsed.success) {
    throw new HomeProfileDetailFetchError(
      'HOME_PROFILE_DETAIL_UPSTREAM_INVALID',
      'Public profile detail response did not match the public contract.',
    );
  }

  return parsed.data;
}

export const homeProfileDetailApi = {
  getCurrentSeasonProfile,
  getPreviousSeasonProfile,
  getPublicProfileByUserId,
};

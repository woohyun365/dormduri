import { previousSeasonProfileResponseSchema } from '@repo/shared/season/participation';
import type { NextRequest } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

const UPSTREAM_PREVIOUS_SEASON_PROFILE_PATH = '/api/seasons/previous/profile';

export async function GET(request: NextRequest) {
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: UPSTREAM_PREVIOUS_SEASON_PROFILE_PATH,
    operation: 'season.previous_profile',
    authenticated: true,
    responseSchema: previousSeasonProfileResponseSchema,
  });
}

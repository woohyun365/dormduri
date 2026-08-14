import { seasonProfileDraftResponseSchema } from '@repo/shared/season/participation';
import type { NextRequest } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

const UPSTREAM_CURRENT_SEASON_PROFILE_PATH = '/api/seasons/current/profile';

export async function GET(request: NextRequest) {
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: UPSTREAM_CURRENT_SEASON_PROFILE_PATH,
    operation: 'season.current_profile',
    authenticated: true,
    responseSchema: seasonProfileDraftResponseSchema,
  });
}

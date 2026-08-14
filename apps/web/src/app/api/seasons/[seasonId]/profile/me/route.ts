import { previousSeasonProfileResponseSchema } from '@repo/shared/season/participation';
import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardValidatedBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type SeasonProfileHistoryRouteContext = BffRouteContext<{ seasonId: string }>;

export async function GET(request: NextRequest, context: SeasonProfileHistoryRouteContext) {
  const { seasonId } = await resolveBffRouteParams(context);
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: `/api/seasons/${encodeBffPathSegment(seasonId)}/profile/me`,
    operation: 'season.history_profile',
    authenticated: true,
    responseSchema: previousSeasonProfileResponseSchema,
  });
}

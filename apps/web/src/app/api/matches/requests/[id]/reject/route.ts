import { matchRequestActionResponseSchema } from '@repo/shared/match/contract';
import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';
import { forwardMatchBffRequest } from '../../../_match-bff';

type RouteContext = BffRouteContext<{ id: string }>;

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await resolveBffRouteParams(context);
  return forwardMatchBffRequest({
    request,
    method: 'POST',
    path: `/api/matches/requests/${encodeBffPathSegment(id)}/reject`,
    responseSchema: matchRequestActionResponseSchema,
  });
}

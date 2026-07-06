import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type ActiveMatchRouteContext = BffRouteContext<{ id: string }>;

export async function POST(request: NextRequest, context: ActiveMatchRouteContext) {
  const { id } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    method: 'POST',
    path: `/api/matches/active/${encodeBffPathSegment(id)}/unmatch-request/cancel`,
    authenticated: true,
  });
}

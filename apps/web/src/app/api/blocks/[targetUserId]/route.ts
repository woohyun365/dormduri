import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type TargetUserRouteContext = BffRouteContext<{ targetUserId: string }>;

export async function POST(request: NextRequest, context: TargetUserRouteContext) {
  const { targetUserId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    method: 'POST',
    path: `/api/blocks/${encodeBffPathSegment(targetUserId)}`,
    authenticated: true,
    bodyMode: 'json',
  });
}

export async function DELETE(request: NextRequest, context: TargetUserRouteContext) {
  const { targetUserId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    method: 'DELETE',
    path: `/api/blocks/${encodeBffPathSegment(targetUserId)}`,
    authenticated: true,
    bodyMode: 'json',
  });
}

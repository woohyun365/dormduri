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
    operation: 'bookmark.create',
    method: 'POST',
    path: `/api/bookmarks/${encodeBffPathSegment(targetUserId)}`,
    authenticated: true,
  });
}

export async function DELETE(request: NextRequest, context: TargetUserRouteContext) {
  const { targetUserId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    operation: 'bookmark.delete',
    method: 'DELETE',
    path: `/api/bookmarks/${encodeBffPathSegment(targetUserId)}`,
    authenticated: true,
  });
}

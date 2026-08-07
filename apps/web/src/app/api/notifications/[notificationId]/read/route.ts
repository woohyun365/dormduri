import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type NotificationReadRouteContext = BffRouteContext<{ notificationId: string }>;

export async function POST(request: NextRequest, context: NotificationReadRouteContext) {
  const { notificationId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    operation: 'notification.read',
    method: 'POST',
    path: `/api/notifications/${encodeBffPathSegment(notificationId)}/read`,
    authenticated: true,
  });
}

import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function GET(request: NextRequest) {
  return forwardBffRequest({
    request,
    operation: 'notification.unread_count',
    method: 'GET',
    path: '/api/notifications/unread-count',
    authenticated: true,
  });
}

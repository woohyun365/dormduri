import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function POST(request: NextRequest) {
  return forwardBffRequest({
    request,
    operation: 'notification.read_all',
    method: 'POST',
    path: '/api/notifications/read-all',
    authenticated: true,
  });
}

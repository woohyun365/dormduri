import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function GET(request: NextRequest) {
  return forwardBffRequest({
    request,
    method: 'GET',
    path: '/api/support/tickets',
    authenticated: true,
    includeQuery: true,
  });
}

export async function POST(request: NextRequest) {
  return forwardBffRequest({
    request,
    method: 'POST',
    path: '/api/support/tickets',
    authenticated: true,
    bodyMode: 'json',
  });
}

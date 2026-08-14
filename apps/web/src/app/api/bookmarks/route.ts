import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function GET(request: NextRequest) {
  return forwardBffRequest({
    request,
    operation: 'bookmark.list',
    method: 'GET',
    path: '/api/bookmarks',
    authenticated: true,
    includeQuery: true,
  });
}

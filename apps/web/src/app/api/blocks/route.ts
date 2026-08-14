import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function GET(request: NextRequest) {
  return forwardBffRequest({
    request,
    operation: 'block.list',
    method: 'GET',
    path: '/api/blocks',
    authenticated: true,
    includeQuery: true,
  });
}

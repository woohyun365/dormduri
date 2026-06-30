import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function POST(request: NextRequest) {
  return forwardBffRequest({
    request,
    method: 'POST',
    path: '/api/seasons/current/participation/deregister',
    authenticated: true,
  });
}

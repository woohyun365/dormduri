import type { NextRequest } from 'next/server';
import { forwardBffRequest } from '@/app/api/_bff/forward';

export async function GET(request: NextRequest) {
  return forwardBffRequest({
    request,
    operation: 'report.list',
    method: 'GET',
    path: '/api/reports',
    authenticated: true,
    includeQuery: true,
  });
}

export async function POST(request: NextRequest) {
  return forwardBffRequest({
    request,
    operation: 'report.create',
    method: 'POST',
    path: '/api/reports',
    authenticated: true,
    bodyMode: 'json',
  });
}

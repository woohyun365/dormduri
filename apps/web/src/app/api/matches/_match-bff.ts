import type { NextRequest, NextResponse } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

type SafeParseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

function resolveMatchOperation(path: string, method: 'GET' | 'POST'): string {
  if (path === '/api/matches/overview') return 'match.overview';
  if (path === '/api/matches/history') return 'match.history';
  if (path === '/api/matches/active') return 'match.active';
  if (path === '/api/matches/requests')
    return `match.request.${method === 'GET' ? 'list' : 'create'}`;
  if (path.endsWith('/accept')) return 'match.request.accept';
  if (path.endsWith('/reject')) return 'match.request.reject';
  if (path.endsWith('/cancel'))
    return path.includes('unmatch-request')
      ? 'match.unmatch_request.cancel'
      : 'match.request.cancel';
  if (path.endsWith('/unmatch-request')) return 'match.unmatch_request.create';
  if (path.endsWith('/counterpart-profile')) return 'match.history.counterpart_profile';
  return 'match.request';
}

export async function forwardMatchBffRequest<T>(input: {
  request: NextRequest;
  method: 'GET' | 'POST';
  path: string;
  responseSchema: SafeParseSchema<T>;
  body?: string;
}): Promise<NextResponse> {
  return forwardValidatedBffRequest({
    request: input.request,
    method: input.method,
    path: input.path,
    operation: resolveMatchOperation(input.path, input.method),
    authenticated: true,
    bodyMode: input.body ? 'json' : 'none',
    body: input.body,
    responseSchema: input.responseSchema,
  });
}

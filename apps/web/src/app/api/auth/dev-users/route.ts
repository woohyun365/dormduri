import type { NextRequest } from 'next/server';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '@/auth/bff';

export async function GET(request: NextRequest) {
  const { response, json } = await forwardAuthRequest(
    'GET',
    '/auth/dev/users',
    undefined,
    { headers: getForwardHeaders(request) },
    { requestHeaders: request.headers },
  );

  return buildJsonResponse(response, json);
}

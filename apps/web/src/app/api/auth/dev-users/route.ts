import type { NextRequest } from 'next/server';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '../_shared';

export async function GET(request: NextRequest) {
  const { response, json } = await forwardAuthRequest('GET', '/auth/dev/users', undefined, {
    headers: getForwardHeaders(request),
  });

  return buildJsonResponse(response, json);
}

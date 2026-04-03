import { NextRequest } from 'next/server';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getForwardHeaders,
} from '../_shared';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { response, json } = await forwardAuthRequest(
    'POST',
    '/auth/logout',
    {},
    {
      headers: getForwardHeaders(request, token ? { Authorization: `Bearer ${token}` } : undefined),
    },
  );

  const nextResponse = buildJsonResponse(response, json);
  clearAuthCookie(nextResponse);
  return nextResponse;
}

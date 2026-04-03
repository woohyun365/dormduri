import { NextRequest } from 'next/server';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getForwardHeaders,
} from '../_shared';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  try {
    const { response, json } = await forwardAuthRequest('GET', '/auth/session', undefined, {
      headers: getForwardHeaders(request, token ? { Authorization: `Bearer ${token}` } : undefined),
    });

    const nextResponse = buildJsonResponse(response, {
      authenticated: json.authenticated === true,
      user: json.user,
    });

    if (json.authenticated !== true) {
      clearAuthCookie(nextResponse);
    }

    return nextResponse;
  } catch {
    const nextResponse = buildJsonResponse(new Response('{}', { status: 200 }), {
      authenticated: false,
    });
    clearAuthCookie(nextResponse);
    return nextResponse;
  }
}

import type { NextRequest } from 'next/server';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getAuthRenewalTokenCookie,
  getForwardHeaders,
  setAuthTransportCookies,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  const renewalToken = getAuthRenewalTokenCookie(request);
  if (!renewalToken) {
    const nextResponse = buildJsonResponse(new Response('{}', { status: 200 }), {
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });
    clearAuthCookie(nextResponse);
    return nextResponse;
  }

  const { response, json } = await forwardAuthRequest(
    'POST',
    '/auth/renew-session',
    { renewalToken },
    {
      headers: getForwardHeaders(request),
    },
  );

  const nextResponse = buildJsonResponse(response, {
    success: json.success,
    error: json.error,
    code: json.code,
    userActionable: json.userActionable,
  });

  if (
    json.success === true &&
    typeof json.accessToken === 'string' &&
    typeof json.renewalToken === 'string'
  ) {
    setAuthTransportCookies(nextResponse, {
      accessToken: json.accessToken,
      renewalToken: json.renewalToken,
      rememberMe: true,
    });
    return nextResponse;
  }

  clearAuthCookie(nextResponse);
  return nextResponse;
}

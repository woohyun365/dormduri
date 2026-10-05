import type { NextRequest } from 'next/server';
import { renewSessionResponseSchema } from '@repo/shared/auth/response';
import { AUTH_SESSION_STALE_RETRY_HEADER } from '@/auth/model/session-resolution.constants';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getAuthRenewalTokenCookie,
  getForwardHeaders,
  recordAuthMutationRequestInspection,
  setAuthTransportCookies,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  recordAuthMutationRequestInspection(request);
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
    { requestHeaders: request.headers, responseSchema: renewSessionResponseSchema },
  );

  const nextResponse = buildJsonResponse(response, {
    success: json.success,
    error: json.error,
    code: json.code,
    userActionable: json.userActionable,
    retryAfterMilliseconds: json.retryAfterMilliseconds,
  });

  if (
    json.success === true &&
    typeof json.accessToken === 'string' &&
    typeof json.renewalToken === 'string' &&
    typeof json.rememberMe === 'boolean'
  ) {
    setAuthTransportCookies(nextResponse, {
      accessToken: json.accessToken,
      renewalToken: json.renewalToken,
      rememberMe: json.rememberMe,
    });
    return nextResponse;
  }

  if (
    json.success === false &&
    json.code === 'AUTH_SESSION_RENEWAL_STALE' &&
    typeof json.retryAfterMilliseconds === 'number'
  ) {
    nextResponse.headers.set(AUTH_SESSION_STALE_RETRY_HEADER, String(json.retryAfterMilliseconds));
    return nextResponse;
  }

  clearAuthCookie(nextResponse);
  return nextResponse;
}

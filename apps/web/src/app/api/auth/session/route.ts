import type { NextRequest } from 'next/server';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getAuthRenewalTokenCookie,
  getAuthTokenCookie,
  getForwardHeaders,
  setAuthTransportCookies,
} from '@/auth/bff';

export async function GET(request: NextRequest) {
  const token = getAuthTokenCookie(request);
  const renewalToken = getAuthRenewalTokenCookie(request);
  try {
    const { response, json } = await forwardAuthRequest('GET', '/auth/session', undefined, {
      headers: getForwardHeaders(request, token ? { Authorization: `Bearer ${token}` } : undefined),
    });

    const nextResponse = buildJsonResponse(response, {
      authenticated: json.authenticated === true,
      user: json.user,
    });

    if (json.authenticated === true) {
      return nextResponse;
    }

    if (!renewalToken) {
      clearAuthCookie(nextResponse);
      return nextResponse;
    }

    const { json: renewalJson } = await forwardAuthRequest(
      'POST',
      '/auth/renew-session',
      { renewalToken },
      {
        headers: getForwardHeaders(request),
      },
    );

    if (
      renewalJson.success === true &&
      typeof renewalJson.accessToken === 'string' &&
      typeof renewalJson.renewalToken === 'string'
    ) {
      const { response: renewedSessionResponse, json: renewedSessionJson } =
        await forwardAuthRequest('GET', '/auth/session', undefined, {
          headers: getForwardHeaders(request, {
            Authorization: `Bearer ${renewalJson.accessToken}`,
          }),
        });
      const renewedNextResponse = buildJsonResponse(renewedSessionResponse, {
        authenticated: renewedSessionJson.authenticated === true,
        user: renewedSessionJson.user,
      });

      if (renewedSessionJson.authenticated === true) {
        setAuthTransportCookies(renewedNextResponse, {
          accessToken: renewalJson.accessToken,
          renewalToken: renewalJson.renewalToken,
          rememberMe: true,
        });
        return renewedNextResponse;
      }

      clearAuthCookie(renewedNextResponse);
      return renewedNextResponse;
    }

    clearAuthCookie(nextResponse);
    return nextResponse;
  } catch {
    const nextResponse = buildJsonResponse(new Response('{}', { status: 200 }), {
      authenticated: false,
    });
    clearAuthCookie(nextResponse);
    return nextResponse;
  }
}

import type { NextRequest } from 'next/server';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders, setAuthCookie } from './_shared';

export function createForwardPostHandler<TBody extends Record<string, unknown>>(path: string) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as TBody;
    const { response, json } = await forwardAuthRequest('POST', path, body, {
      headers: getForwardHeaders(request),
    });

    return buildJsonResponse(response, json);
  };
}

export function createAuthenticatedForwardPostHandler<TBody extends Record<string, unknown>>(
  path: string,
  options: { setAuthCookieFromAccessToken?: boolean } = {},
) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as TBody;
    const token = request.cookies.get('auth-token')?.value;
    const { response, json } = await forwardAuthRequest('POST', path, body, {
      headers: getForwardHeaders(request, token ? { Authorization: `Bearer ${token}` } : undefined),
    });

    const nextResponse = buildJsonResponse(response, {
      ...json,
      accessToken: undefined,
      rememberMe: undefined,
    });

    if (
      options.setAuthCookieFromAccessToken === true &&
      json.success === true &&
      typeof json.accessToken === 'string'
    ) {
      setAuthCookie(nextResponse, json.accessToken, json.rememberMe === true);
    }

    return nextResponse;
  };
}

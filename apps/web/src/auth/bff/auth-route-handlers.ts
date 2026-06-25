import type { NextRequest } from 'next/server';
import { getAuthTokenCookie, setAuthTransportCookies } from './auth-cookies';
import { forwardAuthRequest, getForwardHeaders } from './auth-forward';
import {
  parseStrictJsonRequest,
  pickAuthMutationResponseBody,
  type StrictRequestSchema,
} from './auth-request-guard';
import { buildJsonResponse } from './auth-response';

export function createForwardPostHandler<TBody extends Record<string, unknown>>(path: string) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as TBody;
    const { response, json } = await forwardAuthRequest('POST', path, body, {
      headers: getForwardHeaders(request),
    });

    return buildJsonResponse(response, json);
  };
}

export function createStrictForwardPostHandler<TBody extends Record<string, unknown>>(input: {
  path: string;
  schema: StrictRequestSchema<TBody>;
  invalidCode: string;
}) {
  return async function POST(request: NextRequest) {
    const parsed = await parseStrictJsonRequest(request, input.schema, input.invalidCode);
    if (!parsed.success) {
      return parsed.response;
    }

    const { response, json } = await forwardAuthRequest('POST', input.path, parsed.data, {
      headers: getForwardHeaders(request),
    });

    return buildJsonResponse(response, pickAuthMutationResponseBody(json));
  };
}

export function createAuthenticatedForwardPostHandler<TBody extends Record<string, unknown>>(
  path: string,
  options: { setAuthCookieFromAccessToken?: boolean } = {},
) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as TBody;
    const token = getAuthTokenCookie(request);
    const { response, json } = await forwardAuthRequest('POST', path, body, {
      headers: getForwardHeaders(request, token ? { Authorization: `Bearer ${token}` } : undefined),
    });

    const nextResponse = buildJsonResponse(response, {
      ...json,
      accessToken: undefined,
      renewalToken: undefined,
      rememberMe: undefined,
    });

    if (
      options.setAuthCookieFromAccessToken === true &&
      json.success === true &&
      typeof json.accessToken === 'string'
    ) {
      setAuthTransportCookies(nextResponse, {
        accessToken: json.accessToken,
        rememberMe: json.rememberMe === true,
        renewalToken: typeof json.renewalToken === 'string' ? json.renewalToken : undefined,
      });
    }

    return nextResponse;
  };
}
